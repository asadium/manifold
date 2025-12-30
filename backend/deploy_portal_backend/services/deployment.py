import os
import logging
import paramiko
from typing import Optional
from deploy_portal_backend.models.target import Target
from deploy_portal_backend.models.deployment import DeploymentApplyRequest

logger = logging.getLogger(__name__)


class DeploymentService:
    """Service for deploying Docker containers via SSH."""
    
    @staticmethod
    def _get_sudo_prefix(ssh: paramiko.SSHClient) -> str:
        """Check if sudo is available and return appropriate prefix."""
        check_sudo_cmd = "command -v sudo >/dev/null 2>&1 && echo 'sudo' || echo 'no_sudo'"
        exit_status, stdout_text, _ = DeploymentService._execute_command(
            ssh, check_sudo_cmd, "Check sudo availability"
        )
        
        if "sudo" in stdout_text.lower():
            # Check if passwordless sudo is available
            check_passwordless = "sudo -n true 2>&1 && echo 'passwordless' || echo 'needs_password'"
            exit_status, sudo_check, _ = DeploymentService._execute_command(
                ssh, check_passwordless, "Check passwordless sudo"
            )
            if "passwordless" in sudo_check.lower():
                logger.debug("Passwordless sudo available")
                return "sudo "
            else:
                logger.warning("Sudo requires password - assuming passwordless sudo is configured")
                return "sudo "
        else:
            # Check if we're already root
            check_root_cmd = "[ $(id -u) -eq 0 ] && echo 'root' || echo 'not_root'"
            exit_status, root_check, _ = DeploymentService._execute_command(
                ssh, check_root_cmd, "Check if root user"
            )
            if "root" in root_check.lower():
                logger.debug("Running as root, no sudo needed")
                return ""
            else:
                raise Exception("Cannot install Docker: user is not root and sudo is not available")
    
    @staticmethod
    def _check_and_install_docker(ssh: paramiko.SSHClient, target: Target):
        """Check if Docker is installed, install if not."""
        logger.info("Checking if Docker is installed on remote VM...")
        
        # Get sudo prefix
        try:
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
        except Exception as e:
            logger.error(f"Cannot proceed with Docker installation: {str(e)}")
            raise
        
        # Check if docker command exists
        check_cmd = "command -v docker >/dev/null 2>&1 && echo 'installed' || echo 'not_installed'"
        exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
            ssh, check_cmd, "Check Docker installation"
        )
        
        if "installed" in stdout_text.lower():
            # Verify Docker is working
            version_cmd = "docker --version"
            exit_status, version_output, _ = DeploymentService._execute_command(
                ssh, version_cmd, "Check Docker version"
            )
            if exit_status == 0:
                logger.info(f"Docker is already installed: {version_output}")
                return
            else:
                logger.warning("Docker command exists but doesn't work, attempting reinstall...")
        
        logger.info("Docker not found, installing Docker...")
        
        # Detect OS and install Docker accordingly
        detect_os_cmd = "cat /etc/os-release | grep '^ID=' | cut -d'=' -f2 | tr -d '\"'"
        exit_status, os_id, _ = DeploymentService._execute_command(
            ssh, detect_os_cmd, "Detect OS"
        )
        
        os_id = os_id.lower().strip() if os_id else "unknown"
        logger.info(f"Detected OS: {os_id}")
        
        if os_id in ["ubuntu", "debian"]:
            DeploymentService._install_docker_debian(ssh, sudo_prefix)
        elif os_id in ["centos", "rhel", "fedora", "rocky", "almalinux"]:
            DeploymentService._install_docker_centos(ssh, sudo_prefix)
        else:
            logger.warning(f"Unknown OS '{os_id}', attempting generic Docker installation...")
            DeploymentService._install_docker_generic(ssh, sudo_prefix)
        
        # Verify installation
        verify_cmd = "docker --version"
        exit_status, version_output, _ = DeploymentService._execute_command(
            ssh, verify_cmd, "Verify Docker installation"
        )
        
        if exit_status != 0:
            raise Exception("Docker installation failed - docker command not available after installation")
        
        logger.info(f"Docker installed successfully: {version_output}")
    
    @staticmethod
    def _install_docker_debian(ssh: paramiko.SSHClient, sudo_prefix: str):
        """Install Docker on Debian/Ubuntu systems."""
        logger.info("Installing Docker on Debian/Ubuntu system...")
        
        commands = [
            (f"{sudo_prefix}apt-get update", "Update package list"),
            (f"{sudo_prefix}apt-get install -y ca-certificates curl gnupg lsb-release", "Install prerequisites"),
            (f"{sudo_prefix}install -m 0755 -d /etc/apt/keyrings", "Create keyring directory"),
            (f"curl -fsSL https://download.docker.com/linux/ubuntu/gpg | {sudo_prefix}gpg --dearmor -o /etc/apt/keyrings/docker.gpg", "Add Docker GPG key"),
            (f"{sudo_prefix}chmod a+r /etc/apt/keyrings/docker.gpg", "Set keyring permissions"),
            (f"echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" | {sudo_prefix}tee /etc/apt/sources.list.d/docker.list > /dev/null", "Add Docker repository"),
            (f"{sudo_prefix}apt-get update", "Update package list with Docker repo"),
            (f"{sudo_prefix}apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin", "Install Docker"),
            (f"{sudo_prefix}systemctl start docker", "Start Docker service"),
            (f"{sudo_prefix}systemctl enable docker", "Enable Docker service"),
        ]
        
        for cmd, description in commands:
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, cmd, description
            )
            if exit_status != 0:
                # Some commands may fail but are non-critical (like adding repo if already exists)
                if "already exists" not in stderr_text.lower() and "is already the newest version" not in stderr_text.lower() and "already installed" not in stderr_text.lower():
                    logger.warning(f"{description} returned exit code {exit_status}, but continuing...")
                    logger.debug(f"Error: {stderr_text}")
    
    @staticmethod
    def _install_docker_centos(ssh: paramiko.SSHClient, sudo_prefix: str):
        """Install Docker on CentOS/RHEL/Fedora systems."""
        logger.info("Installing Docker on CentOS/RHEL system...")
        
        # Try dnf first (Fedora/newer), fall back to yum
        check_dnf_cmd = "command -v dnf >/dev/null 2>&1 && echo 'dnf' || echo 'yum'"
        exit_status, package_manager, _ = DeploymentService._execute_command(
            ssh, check_dnf_cmd, "Detect package manager"
        )
        pm = "dnf" if "dnf" in package_manager.lower() else "yum"
        logger.info(f"Using package manager: {pm}")
        
        commands = [
            (f"{sudo_prefix}{pm} install -y yum-utils", "Install yum-utils"),
            (f"{sudo_prefix}{pm}-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo", "Add Docker repository"),
            (f"{sudo_prefix}{pm} install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin", "Install Docker"),
            (f"{sudo_prefix}systemctl start docker", "Start Docker service"),
            (f"{sudo_prefix}systemctl enable docker", "Enable Docker service"),
        ]
        
        for cmd, description in commands:
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, cmd, description
            )
            if exit_status != 0:
                if "already installed" not in stderr_text.lower() and "already exists" not in stderr_text.lower():
                    logger.warning(f"{description} returned exit code {exit_status}, but continuing...")
                    logger.debug(f"Error: {stderr_text}")
    
    @staticmethod
    def _install_docker_generic(ssh: paramiko.SSHClient, sudo_prefix: str):
        """Generic Docker installation using convenience script."""
        logger.info("Installing Docker using convenience script...")
        
        commands = [
            ("curl -fsSL https://get.docker.com -o get-docker.sh", "Download Docker install script"),
            (f"{sudo_prefix}sh get-docker.sh", "Run Docker install script"),
            ("rm get-docker.sh", "Clean up install script"),
            (f"{sudo_prefix}systemctl start docker || {sudo_prefix}service docker start", "Start Docker service"),
            (f"{sudo_prefix}systemctl enable docker || {sudo_prefix}chkconfig docker on", "Enable Docker service"),
        ]
        
        for cmd, description in commands:
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, cmd, description
            )
            if exit_status != 0:
                # Some commands may fail (like systemctl vs service)
                if "already installed" not in stderr_text.lower():
                    logger.warning(f"{description} returned exit code {exit_status}, but continuing...")
                    logger.debug(f"Error: {stderr_text}")
    
    @staticmethod
    def _get_ssh_client(target: Target) -> paramiko.SSHClient:
        """Create and configure SSH client for target."""
        logger.info(f"Connecting to {target.name} ({target.address}) as {target.ssh_user}")
        
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Expand user home directory (~) and resolve absolute path
        ssh_key_path = os.path.expanduser(target.ssh_key_path)
        ssh_key_path = os.path.abspath(ssh_key_path)
        
        logger.debug(f"Resolved SSH key path: {ssh_key_path}")
        
        # Load private key (support both RSA and ED25519)
        if not os.path.exists(ssh_key_path):
            logger.error(f"SSH key not found: {ssh_key_path} (original: {target.ssh_key_path})")
            raise FileNotFoundError(f"SSH key not found: {ssh_key_path}")
        
        logger.debug(f"Loading SSH key from: {ssh_key_path}")
        
        # Try RSA first, then ED25519
        try:
            private_key = paramiko.RSAKey.from_private_key_file(ssh_key_path)
            logger.debug("Loaded RSA key")
        except paramiko.ssh_exception.SSHException:
            try:
                private_key = paramiko.Ed25519Key.from_private_key_file(ssh_key_path)
                logger.debug("Loaded ED25519 key")
            except paramiko.ssh_exception.SSHException:
                logger.error(f"Unsupported SSH key type: {ssh_key_path}")
                raise ValueError(f"Unsupported SSH key type: {ssh_key_path}")
        
        # Connect to remote host
        try:
            ssh.connect(
                hostname=target.address,
                username=target.ssh_user,
                pkey=private_key,
                timeout=10
            )
            logger.info(f"Successfully connected to {target.address}")
        except Exception as e:
            logger.error(f"Failed to connect to {target.address}: {str(e)}")
            raise
        
        return ssh
    
    @staticmethod
    def _execute_command(ssh: paramiko.SSHClient, command: str, description: str) -> tuple[int, str, str]:
        """Execute a command via SSH and return exit status, stdout, and stderr."""
        logger.info(f"Executing: {description}")
        logger.debug(f"Command: {command}")
        
        stdin, stdout, stderr = ssh.exec_command(command)
        exit_status = stdout.channel.recv_exit_status()
        stdout_text = stdout.read().decode().strip()
        stderr_text = stderr.read().decode().strip()
        
        if exit_status == 0:
            logger.info(f"✓ {description} - Success")
            if stdout_text:
                logger.debug(f"Output: {stdout_text}")
        else:
            logger.warning(f"✗ {description} - Failed (exit code: {exit_status})")
            if stderr_text:
                logger.warning(f"Error output: {stderr_text}")
            if stdout_text:
                logger.debug(f"Output: {stdout_text}")
        
        return exit_status, stdout_text, stderr_text
    
    @staticmethod
    def deploy_single_container(target: Target, image: str, container_name: str, ports: Optional[str] = None) -> str:
        """Deploy a single Docker container on remote VM."""
        logger.info(f"Starting single container deployment: {container_name} ({image})")
        
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Check and install Docker if needed
            DeploymentService._check_and_install_docker(ssh, target)
            
            # Get sudo prefix for docker commands (may need sudo if user not in docker group)
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
            
            # Check if user can run docker without sudo
            test_docker_cmd = "docker ps >/dev/null 2>&1 && echo 'no_sudo' || echo 'needs_sudo'"
            exit_status, docker_check, _ = DeploymentService._execute_command(
                ssh, test_docker_cmd, "Check if docker needs sudo"
            )
            docker_sudo = "" if "no_sudo" in docker_check.lower() else sudo_prefix
            
            # Stop and remove existing container if it exists
            stop_cmd = f"{docker_sudo}docker stop {container_name} 2>/dev/null || true"
            DeploymentService._execute_command(ssh, stop_cmd, f"Stop existing container '{container_name}'")
            
            remove_cmd = f"{docker_sudo}docker rm {container_name} 2>/dev/null || true"
            DeploymentService._execute_command(ssh, remove_cmd, f"Remove existing container '{container_name}'")
            
            # Build docker run command
            docker_cmd = f"{docker_sudo}docker run -d --name {container_name}"
            
            if ports:
                # Handle port mappings (e.g., "8080:80" or "8080:80,8443:443")
                port_mappings = [p.strip() for p in ports.split(",")]
                logger.info(f"Configuring port mappings: {', '.join(port_mappings)}")
                for port_map in port_mappings:
                    docker_cmd += f" -p {port_map}"
            
            docker_cmd += f" {image}"
            
            # Execute docker run
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, docker_cmd, f"Deploy container '{container_name}'"
            )
            
            if exit_status != 0:
                error_msg = f"Docker run failed: {stderr_text or 'Unknown error'}"
                logger.error(error_msg)
                raise Exception(error_msg)
            
            container_id = stdout_text.strip()
            if container_id:
                success_msg = f"Container {container_name} deployed successfully (ID: {container_id[:12]})"
                logger.info(success_msg)
                return success_msg
            else:
                error_msg = "Docker run succeeded but no container ID returned"
                logger.error(error_msg)
                raise Exception(error_msg)
            
        except Exception as e:
            logger.error(f"Deployment failed: {str(e)}")
            raise
        finally:
            ssh.close()
            logger.info(f"Closed SSH connection to {target.address}")
    
    @staticmethod
    def deploy_compose_file(target: Target, compose_file_path: str) -> str:
        """Deploy Docker Compose stack on remote VM."""
        logger.info(f"Starting Docker Compose deployment from: {compose_file_path}")
        
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Check and install Docker if needed
            DeploymentService._check_and_install_docker(ssh, target)
            
            # Get sudo prefix for docker commands (may need sudo if user not in docker group)
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
            
            # Check if user can run docker without sudo
            test_docker_cmd = "docker ps >/dev/null 2>&1 && echo 'no_sudo' || echo 'needs_sudo'"
            exit_status, docker_check, _ = DeploymentService._execute_command(
                ssh, test_docker_cmd, "Check if docker needs sudo"
            )
            docker_sudo = "" if "no_sudo" in docker_check.lower() else sudo_prefix
            
            # Change to directory containing docker-compose.yml
            compose_dir = os.path.dirname(compose_file_path)
            compose_file = os.path.basename(compose_file_path)
            
            logger.info(f"Compose directory: {compose_dir}, file: {compose_file}")
            
            # Check if compose file exists
            check_cmd = f"test -f {compose_file_path} && echo 'exists' || echo 'not found'"
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, check_cmd, f"Check if compose file exists: {compose_file_path}"
            )
            
            if "not found" in stdout_text.lower():
                error_msg = f"Docker Compose file not found: {compose_file_path}"
                logger.error(error_msg)
                raise FileNotFoundError(error_msg)
            
            # Navigate to directory and run docker compose up
            docker_compose_cmd = f"cd {compose_dir} && {docker_sudo}docker compose -f {compose_file} up -d"
            
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, docker_compose_cmd, f"Deploy Docker Compose stack from {compose_file_path}"
            )
            
            if exit_status != 0:
                error_msg = f"Docker Compose deployment failed: {stderr_text or 'Unknown error'}"
                logger.error(error_msg)
                raise Exception(error_msg)
            
            success_msg = f"Docker Compose stack deployed successfully from {compose_file_path}"
            logger.info(success_msg)
            if stdout_text:
                logger.debug(f"Compose output: {stdout_text}")
            
            return success_msg
            
        except Exception as e:
            logger.error(f"Docker Compose deployment failed: {str(e)}")
            raise
        finally:
            ssh.close()
            logger.info(f"Closed SSH connection to {target.address}")
    
    @staticmethod
    def deploy(request: DeploymentApplyRequest, target: Target) -> str:
        """Deploy based on request type."""
        if request.compose_file_path:
            return DeploymentService.deploy_compose_file(target, request.compose_file_path)
        else:
            return DeploymentService.deploy_single_container(
                target,
                request.image,
                request.container_name,
                request.ports
            )

