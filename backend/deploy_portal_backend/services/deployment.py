import os
import logging
import paramiko
from typing import Optional
from deploy_portal_backend.models.target import Target
from deploy_portal_backend.models.deployment import DeploymentApplyRequest

logger = logging.getLogger(__name__)

# Import log storage function
try:
    from deploy_portal_backend.api.routes_deployments import add_deployment_log
except ImportError:
    # Fallback if circular import
    def add_deployment_log(deployment_id: int, level: str, message: str):
        pass


class DeploymentService:
    """Service for deploying Docker containers via SSH."""
    
    @staticmethod
    def _get_sudo_prefix(ssh: paramiko.SSHClient, deployment_id: Optional[int] = None) -> str:
        """Check if sudo is available and return appropriate prefix."""
        check_sudo_cmd = "command -v sudo >/dev/null 2>&1 && echo 'sudo' || echo 'no_sudo'"
        exit_status, stdout_text, _ = DeploymentService._execute_command(
            ssh, check_sudo_cmd, "Check sudo availability", deployment_id
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
    def _check_and_install_docker(ssh: paramiko.SSHClient, target: Target, deployment_id: Optional[int] = None):
        """Check if Docker is installed, install if not."""
        log_msg = "Checking if Docker is installed on remote VM..."
        logger.info(log_msg)
        if deployment_id:
            add_deployment_log(deployment_id, "INFO", log_msg)
        
        # Get sudo prefix
        try:
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh, deployment_id)
        except Exception as e:
            error_msg = f"Cannot proceed with Docker installation: {str(e)}"
            logger.error(error_msg)
            if deployment_id:
                add_deployment_log(deployment_id, "ERROR", error_msg)
            raise
        
        # Check if docker command exists
        check_cmd = "command -v docker >/dev/null 2>&1 && echo 'installed' || echo 'not_installed'"
        exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
            ssh, check_cmd, "Check Docker installation", deployment_id
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
    def _install_docker_debian(ssh: paramiko.SSHClient, sudo_prefix: str, deployment_id: Optional[int] = None):
        """Install Docker on Debian/Ubuntu systems."""
        log_msg = "Installing Docker on Debian/Ubuntu system..."
        logger.info(log_msg)
        if deployment_id:
            add_deployment_log(deployment_id, "INFO", log_msg)
        
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
                ssh, cmd, description, deployment_id
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
    def _install_docker_generic(ssh: paramiko.SSHClient, sudo_prefix: str, deployment_id: Optional[int] = None):
        """Generic Docker installation using convenience script."""
        log_msg = "Installing Docker using convenience script..."
        logger.info(log_msg)
        if deployment_id:
            add_deployment_log(deployment_id, "INFO", log_msg)
        
        commands = [
            ("curl -fsSL https://get.docker.com -o get-docker.sh", "Download Docker install script"),
            (f"{sudo_prefix}sh get-docker.sh", "Run Docker install script"),
            ("rm get-docker.sh", "Clean up install script"),
            (f"{sudo_prefix}systemctl start docker || {sudo_prefix}service docker start", "Start Docker service"),
            (f"{sudo_prefix}systemctl enable docker || {sudo_prefix}chkconfig docker on", "Enable Docker service"),
        ]
        
        for cmd, description in commands:
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, cmd, description, deployment_id
            )
            if exit_status != 0:
                # Some commands may fail (like systemctl vs service)
                if "already installed" not in stderr_text.lower():
                    logger.warning(f"{description} returned exit code {exit_status}, but continuing...")
                    logger.debug(f"Error: {stderr_text}")
    
    @staticmethod
    def _get_ssh_client(target: Target, deployment_id: Optional[int] = None) -> paramiko.SSHClient:
        """Create and configure SSH client for target."""
        log_msg = f"Connecting to {target.name} ({target.address}) as {target.ssh_user}"
        logger.info(log_msg)
        if deployment_id:
            add_deployment_log(deployment_id, "INFO", log_msg)
        
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
            success_msg = f"Successfully connected to {target.address}"
            logger.info(success_msg)
            if deployment_id:
                add_deployment_log(deployment_id, "INFO", success_msg)
        except Exception as e:
            error_msg = f"Failed to connect to {target.address}: {str(e)}"
            logger.error(error_msg)
            if deployment_id:
                add_deployment_log(deployment_id, "ERROR", error_msg)
            raise
        
        return ssh
    
    @staticmethod
    def _execute_command(ssh: paramiko.SSHClient, command: str, description: str, deployment_id: Optional[int] = None) -> tuple[int, str, str]:
        """Execute a command via SSH and return exit status, stdout, and stderr."""
        log_msg = f"Executing: {description}"
        logger.info(log_msg)
        logger.debug(f"Command: {command}")
        if deployment_id:
            add_deployment_log(deployment_id, "INFO", log_msg)
        
        stdin, stdout, stderr = ssh.exec_command(command)
        exit_status = stdout.channel.recv_exit_status()
        stdout_text = stdout.read().decode().strip()
        stderr_text = stderr.read().decode().strip()
        
        if exit_status == 0:
            success_msg = f"✓ {description} - Success"
            logger.info(success_msg)
            if deployment_id:
                add_deployment_log(deployment_id, "INFO", success_msg)
            if stdout_text:
                logger.debug(f"Output: {stdout_text}")
                if deployment_id:
                    add_deployment_log(deployment_id, "DEBUG", f"Output: {stdout_text}")
        else:
            fail_msg = f"✗ {description} - Failed (exit code: {exit_status})"
            logger.warning(fail_msg)
            if deployment_id:
                add_deployment_log(deployment_id, "WARNING", fail_msg)
            if stderr_text:
                logger.warning(f"Error output: {stderr_text}")
                if deployment_id:
                    add_deployment_log(deployment_id, "ERROR", f"Error output: {stderr_text}")
            if stdout_text:
                logger.debug(f"Output: {stdout_text}")
                if deployment_id:
                    add_deployment_log(deployment_id, "DEBUG", f"Output: {stdout_text}")
        
        return exit_status, stdout_text, stderr_text
    
    @staticmethod
    def deploy_single_container(target: Target, image: str, container_name: str, ports: Optional[str] = None, deployment_id: Optional[int] = None) -> str:
        """Deploy a single Docker container on remote VM."""
        log_msg = f"Starting single container deployment: {container_name} ({image})"
        logger.info(log_msg)
        if deployment_id:
            add_deployment_log(deployment_id, "INFO", log_msg)
        
        ssh = DeploymentService._get_ssh_client(target, deployment_id)
        
        try:
            # Check and install Docker if needed
            DeploymentService._check_and_install_docker(ssh, target)
            
            # Get sudo prefix for docker commands (may need sudo if user not in docker group)
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh, deployment_id)
            
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
    def deploy_compose_file(target: Target, compose_file_path: str, deployment_id: Optional[int] = None) -> str:
        """Deploy Docker Compose stack on remote VM."""
        log_msg = f"Starting Docker Compose deployment from: {compose_file_path}"
        logger.info(log_msg)
        if deployment_id:
            add_deployment_log(deployment_id, "INFO", log_msg)
        
        ssh = DeploymentService._get_ssh_client(target, deployment_id)
        
        try:
            # Check and install Docker if needed
            DeploymentService._check_and_install_docker(ssh, target)
            
            # Get sudo prefix for docker commands (may need sudo if user not in docker group)
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh, deployment_id)
            
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
    def deploy(request: DeploymentApplyRequest, target: Target, deployment_id: Optional[int] = None) -> str:
        """Deploy based on request type."""
        if request.compose_file_path:
            return DeploymentService.deploy_compose_file(target, request.compose_file_path, deployment_id)
        else:
            return DeploymentService.deploy_single_container(
                target,
                request.image,
                request.container_name,
                request.ports,
                deployment_id
            )
    
    @staticmethod
    def list_containers(target: Target) -> list[dict]:
        """List all containers on a target."""
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Get sudo prefix
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
            
            # Check if user can run docker without sudo
            test_docker_cmd = "docker ps >/dev/null 2>&1 && echo 'no_sudo' || echo 'needs_sudo'"
            exit_status, docker_check, _ = DeploymentService._execute_command(
                ssh, test_docker_cmd, "Check if docker needs sudo"
            )
            docker_sudo = "" if "no_sudo" in docker_check.lower() else sudo_prefix
            
            # List all containers (running and stopped)
            list_cmd = f"{docker_sudo}docker ps -a --format '{{{{.ID}}}}\\t{{{{.Names}}}}\\t{{{{.Image}}}}\\t{{{{.Status}}}}\\t{{{{.Ports}}}}'"
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, list_cmd, "List containers"
            )
            
            if exit_status != 0:
                raise Exception(f"Failed to list containers: {stderr_text}")
            
            containers = []
            for line in stdout_text.strip().split('\n'):
                if not line.strip():
                    continue
                parts = line.split('\t')
                if len(parts) >= 4:
                    containers.append({
                        "id": parts[0][:12],  # Short container ID
                        "name": parts[1],
                        "image": parts[2],
                        "status": parts[3],
                        "ports": parts[4] if len(parts) > 4 else ""
                    })
            
            return containers
            
        finally:
            ssh.close()
    
    @staticmethod
    def get_container_logs(target: Target, container_name: str, lines: int = 100) -> str:
        """Get logs for a specific container."""
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Get sudo prefix
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
            
            # Check if user can run docker without sudo
            test_docker_cmd = "docker ps >/dev/null 2>&1 && echo 'no_sudo' || echo 'needs_sudo'"
            exit_status, docker_check, _ = DeploymentService._execute_command(
                ssh, test_docker_cmd, "Check if docker needs sudo"
            )
            docker_sudo = "" if "no_sudo" in docker_check.lower() else sudo_prefix
            
            # Get container logs
            logs_cmd = f"{docker_sudo}docker logs --tail {lines} {container_name} 2>&1"
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, logs_cmd, f"Get logs for container {container_name}"
            )
            
            # Combine stdout and stderr (docker logs outputs to stderr for some logs)
            combined_logs = stdout_text + "\n" + stderr_text if stderr_text else stdout_text
            
            return combined_logs.strip()
            
        finally:
            ssh.close()
    
    @staticmethod
    def get_container_env(target: Target, container_name: str) -> dict:
        """Get environment variables for a container."""
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Get sudo prefix
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
            
            # Check if user can run docker without sudo
            test_docker_cmd = "docker ps >/dev/null 2>&1 && echo 'no_sudo' || echo 'needs_sudo'"
            exit_status, docker_check, _ = DeploymentService._execute_command(
                ssh, test_docker_cmd, "Check if docker needs sudo"
            )
            docker_sudo = "" if "no_sudo" in docker_check.lower() else sudo_prefix
            
            # Get container inspect to extract env vars
            inspect_cmd = f"{docker_sudo}docker inspect {container_name} --format '{{{{json .Config.Env}}}}'"
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, inspect_cmd, f"Get env vars for container {container_name}"
            )
            
            if exit_status != 0:
                raise Exception(f"Failed to get container env: {stderr_text}")
            
            import json
            env_list = json.loads(stdout_text.strip())
            
            # Parse env vars into dict (format: KEY=VALUE)
            env_dict = {}
            for env_var in env_list:
                if '=' in env_var:
                    key, value = env_var.split('=', 1)
                    env_dict[key] = value
                else:
                    env_dict[env_var] = ""
            
            return env_dict
            
        finally:
            ssh.close()
    
    @staticmethod
    def update_container_env(target: Target, container_name: str, env_vars: dict) -> str:
        """Update environment variables for a container by recreating it."""
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Get sudo prefix
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
            
            # Check if user can run docker without sudo
            test_docker_cmd = "docker ps >/dev/null 2>&1 && echo 'no_sudo' || echo 'needs_sudo'"
            exit_status, docker_check, _ = DeploymentService._execute_command(
                ssh, test_docker_cmd, "Check if docker needs sudo"
            )
            docker_sudo = "" if "no_sudo" in docker_check.lower() else sudo_prefix
            
            # Get container configuration
            inspect_cmd = f"{docker_sudo}docker inspect {container_name}"
            exit_status, inspect_output, stderr_text = DeploymentService._execute_command(
                ssh, inspect_cmd, f"Inspect container {container_name}"
            )
            
            if exit_status != 0:
                raise Exception(f"Failed to inspect container: {stderr_text}")
            
            import json
            container_info = json.loads(inspect_output)[0]
            config = container_info['Config']
            host_config = container_info['HostConfig']
            
            # Get image
            image = config['Image']
            
            # Get command
            cmd = config.get('Cmd', [])
            cmd_str = ' '.join(cmd) if cmd else ''
            
            # Get port bindings
            port_bindings = host_config.get('PortBindings', {})
            port_args = []
            for container_port, bindings in port_bindings.items():
                if bindings:
                    host_port = bindings[0]['HostPort']
                    port_args.append(f"-p {host_port}:{container_port.split('/')[0]}")
            
            # Build env var arguments (properly escape values)
            env_args = []
            for key, value in env_vars.items():
                # Escape special characters in value
                escaped_value = str(value).replace('"', '\\"').replace('$', '\\$')
                env_args.append(f'-e {key}="{escaped_value}"')
            
            # Stop and remove old container
            stop_cmd = f"{docker_sudo}docker stop {container_name}"
            DeploymentService._execute_command(ssh, stop_cmd, f"Stop container {container_name}")
            
            remove_cmd = f"{docker_sudo}docker rm {container_name}"
            DeploymentService._execute_command(ssh, remove_cmd, f"Remove container {container_name}")
            
            # Create new container with updated env vars
            docker_run_cmd = f"{docker_sudo}docker run -d --name {container_name}"
            if port_args:
                docker_run_cmd += " " + " ".join(port_args)
            if env_args:
                docker_run_cmd += " " + " ".join(env_args)
            docker_run_cmd += f" {image}"
            if cmd_str:
                docker_run_cmd += f" {cmd_str}"
            
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, docker_run_cmd, f"Recreate container {container_name} with new env vars"
            )
            
            if exit_status != 0:
                raise Exception(f"Failed to recreate container: {stderr_text}")
            
            return f"Container {container_name} restarted with updated environment variables"
            
        finally:
            ssh.close()
    
    @staticmethod
    def get_target_env(target: Target) -> dict:
        """Get environment variables from VM's /etc/environment file."""
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Get sudo prefix
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
            
            # Read /etc/environment file
            read_cmd = f"{sudo_prefix}cat /etc/environment 2>/dev/null || echo ''"
            exit_status, stdout_text, stderr_text = DeploymentService._execute_command(
                ssh, read_cmd, "Read /etc/environment"
            )
            
            env_dict = {}
            if stdout_text.strip():
                for line in stdout_text.strip().split('\n'):
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_dict[key.strip()] = value.strip().strip('"').strip("'")
            
            # Also get current shell environment for comparison
            env_cmd = "env | grep -v '^_' | sort"
            exit_status, env_output, _ = DeploymentService._execute_command(
                ssh, env_cmd, "Get current environment"
            )
            
            # Merge shell env vars (prioritize /etc/environment if both exist)
            if env_output.strip():
                for line in env_output.strip().split('\n'):
                    if '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        if key not in env_dict:  # Only add if not already in /etc/environment
                            env_dict[key] = value.strip()
            
            return env_dict
            
        finally:
            ssh.close()
    
    @staticmethod
    def update_target_env(target: Target, env_vars: dict) -> str:
        """Update environment variables in VM's /etc/environment file."""
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Get sudo prefix
            sudo_prefix = DeploymentService._get_sudo_prefix(ssh)
            
            # Backup original file
            backup_cmd = f"{sudo_prefix}cp /etc/environment /etc/environment.backup.$(date +%s) 2>/dev/null || true"
            DeploymentService._execute_command(ssh, backup_cmd, "Backup /etc/environment")
            
            # Build new environment file content
            env_lines = []
            for key, value in env_vars.items():
                # Escape special characters properly for shell
                escaped_key = str(key).replace('"', '\\"').replace('$', '\\$')
                escaped_value = str(value).replace('"', '\\"').replace('$', '\\$')
                env_lines.append(f'{escaped_key}="{escaped_value}"')
            
            env_content = '\n'.join(env_lines) + '\n'
            
            # Write to temporary file first, then move to /etc/environment
            import time
            import base64
            temp_file = f"/tmp/environment.{target.id}.{int(time.time())}"
            
            # Base64 encode the content to avoid shell escaping issues
            encoded_content = base64.b64encode(env_content.encode()).decode()
            write_cmd = f"echo '{encoded_content}' | base64 -d | {sudo_prefix}tee {temp_file} > /dev/null"
            exit_status, _, stderr_text = DeploymentService._execute_command(
                ssh, write_cmd, f"Write to temp file {temp_file}"
            )
            
            if exit_status != 0:
                raise Exception(f"Failed to write temp file: {stderr_text}")
            
            # Move temp file to /etc/environment
            move_cmd = f"{sudo_prefix}mv {temp_file} /etc/environment"
            exit_status, _, stderr_text = DeploymentService._execute_command(
                ssh, move_cmd, "Move temp file to /etc/environment"
            )
            
            if exit_status != 0:
                raise Exception(f"Failed to update /etc/environment: {stderr_text}")
            
            # Set proper permissions
            chmod_cmd = f"{sudo_prefix}chmod 644 /etc/environment"
            DeploymentService._execute_command(ssh, chmod_cmd, "Set /etc/environment permissions")
            
            return f"VM environment variables updated. Changes will take effect for new sessions. Run 'source /etc/environment' or restart the session to apply immediately."
            
        finally:
            ssh.close()

