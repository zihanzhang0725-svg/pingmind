import paramiko
import socket
import threading

class SshClass:
    """
    ssh连接对象
    本对象提供了密钥连接、密码连接、命令执行、关闭连接及端口转发功能
    """
    ip = ''
    port = 22
    username = ''
    timeout = 0
    ssh = None

    def __init__(self, ip, username, port=22, timeout=30):
        """
        初始化ssh对象
        :param ip: str  主机IP
        :param username: str  登录用户名
        :param port: int  ssh端口
        :param timeout: int  连接超时
        """
        self.ip = ip
        self.username = username
        self.port = port
        self.timeout = timeout
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.ssh = ssh

    def conn_by_key(self, key):
        """
        密钥连接
        :param key: str  rsa密钥路径
        :return: ssh连接对象
        """
        rsa_key = paramiko.RSAKey.from_private_key_file(key)
        self.ssh.connect(hostname=self.ip, port=self.port, username=self.username, pkey=rsa_key, timeout=self.timeout)
        if self.ssh.get_transport().is_active():
            print("密钥连接成功.")
        else:
            self.close()
            raise Exception("密钥连接失败.")

    def conn_by_pwd(self, pwd):
        """
        密码连接
        :param pwd: str  登录密码
        :return: ssh连接对象
        """
        self.ssh.connect(hostname=self.ip, port=self.port, username=self.username, password=pwd, timeout=self.timeout)
        if self.ssh.get_transport().is_active():
            print("密码连接成功.")
        else:
            self.close()
            raise Exception("密码连接失败.")

    def exec_command(self, command):
        """
        命令控制
        :param command: str  命令
        :return: dict  命令执行的返回结果
        """
        if command:
            stdin, stdout, stderr = self.ssh.exec_command(command)
            return {
                "stdin": command,
                "stdout": stdout.read().decode(),
                "stderr": stderr.read().decode()
            }
        else:
            self.close()
            raise Exception("命令不能为空字符串.")

    def start_port_forward(self, local_port, remote_host, remote_port):
        """
        启动本地端口转发
        :param local_port: 本地监听端口
        :param remote_host: 远程目标主机
        :param remote_port: 远程目标端口
        """
        transport = self.ssh.get_transport()
        if not transport.is_active():
            raise Exception("SSH连接未激活，请先建立连接。")

        # 创建本地套接字监听
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(('localhost', local_port))
        sock.listen(5)
        print(f"本地端口转发已启动，监听 localhost:{local_port}")

        def forward_connection():
            while True:
                client, addr = sock.accept()
                # 为每个连接创建线程处理
                threading.Thread(target=self.handle_client, args=(client, remote_host, remote_port)).start()

        # 启动守护线程处理连接
        threading.Thread(target=forward_connection, daemon=True).start()

    def handle_client(self, client, remote_host, remote_port):
        """
        处理客户端连接并进行数据转发
        """
        try:
            # 创建SSH通道
            transport = self.ssh.get_transport()
            chan = transport.open_channel(
                kind='direct-tcpip',
                dest_addr=(remote_host, remote_port),
                src_addr=client.getpeername()
            )
        except Exception as e:
            print(f"无法建立隧道连接: {e}")
            client.close()
            return

        # 数据转发函数
        def forward(src, dst):
            while True:
                data = src.recv(1024)
                if not data:
                    break
                dst.send(data)

        # 启动双向转发
        threading.Thread(target=forward, args=(client, chan)).start()
        threading.Thread(target=forward, args=(chan, client)).start()

    def close(self):
        """
        关闭当前连接
        """
        if self.ssh:
            self.ssh.close()
            print("SSH连接已关闭")
        else:
            raise Exception("SSH关闭失败，当前对象无活跃连接。")


if __name__ == '__main__':
    # 示例：使用密码连接并启动端口转发
    SSH = SshClass(ip="10.108.24.149", username="nlpir", port=37211)
    try:
        SSH.conn_by_pwd("nlpir1013")  # 替换为实际密码
        print("连接成功，启动端口转发...")
        SSH.start_port_forward(11434, 'localhost', 11434)
        # 保持主线程运行
        while True:
            pass
    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        SSH.close()