docimport os
import paramiko
from typing import Optional
from deploy_portal_backend.models.target import Target
from deploy_portal_backend.models.deployment import DeploymentApplyRequest


class DeploymentService:
    """Service for deploying Docker containers via SSH."""
    
    @staticmethod
    def _get_ssh_client(target: Target) -> paramiko.SSHClient:
        """Create and configure SSH client for target."""
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Load private key (support both RSA and ED25519)
        if not os.path.exists(target.ssh_key_path):
            raise FileNotFoundError(f"SSH key not found: {target.ssh_key_path}")
        
        # Try RSA first, then ED25519
        try:
            private_key = paramiko.RSAKey.from_private_key_file(target.ssh_key_path)
        except paramiko.ssh_exception.SSHException:
            try:
                private_key = paramiko.Ed25519Key.from_private_key_file(target.ssh_key_path)
            except paramiko.ssh_exception.SSHException:
                raise ValueError(f"Unsupported SSH key type: {target.ssh_key_path}")
        
        # Connect to remote host
        ssh.connect(
            hostname=target.address,
            username=target.ssh_user,
            pkey=private_key,
            timeout=10
        )
        
        return ssh
    
    @staticmethod
    def deploy_single_container(target: Target, image: str, container_name: str, ports: Optional[str] = None) -> str:
        """Deploy a single Docker container on remote VM."""
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Stop and remove existing container if it exists
            stop_cmd = f"docker stop {container_name} 2>/dev/null || true"
            remove_cmd = f"docker rm {container_name} 2>/dev/null || true"
            
            ssh.exec_command(stop_cmd)
            ssh.exec_command(remove_cmd)
            
            # Build docker run command
            docker_cmd = f"docker run -d --name {container_name}"
            
            if ports:
                # Handle port mappings (e.g., "8080:80" or "8080:80,8443:443")
                port_mappings = [p.strip() for p in ports.split(",")]
                for port_map in port_mappings:
                    docker_cmd += f" -p {port_map}"
            
            docker_cmd += f" {image}"
            
            # Execute docker run
            stdin, stdout, stderr = ssh.exec_command(docker_cmd)
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status != 0:
                error_output = stderr.read().decode()
                raise Exception(f"Docker run failed: {error_output}")
            
            container_id = stdout.read().decode().strip()
            return f"Container {container_name} deployed successfully (ID: {container_id[:12]})"
            
        finally:
            ssh.close()
    
    @staticmethod
    def deploy_compose_file(target: Target, compose_file_path: str) -> str:
        """Deploy Docker Compose stack on remote VM."""
        ssh = DeploymentService._get_ssh_client(target)
        
        try:
            # Change to directory containing docker-compose.yml
            compose_dir = os.path.dirname(compose_file_path)
            compose_file = os.path.basename(compose_file_path)
            
            # Navigate to directory and run docker compose up
            docker_compose_cmd = f"cd {compose_dir} && docker compose -f {compose_file} up -d"
            
            stdin, stdout, stderr = ssh.exec_command(docker_compose_cmd)
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status != 0:
                error_output = stderr.read().decode()
                raise Exception(f"Docker Compose deployment failed: {error_output}")
            
            output = stdout.read().decode()
            return f"Docker Compose stack deployed successfully from {compose_file_path}"
            
        finally:
            ssh.close()
    
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

