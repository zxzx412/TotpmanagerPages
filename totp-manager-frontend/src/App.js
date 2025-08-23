import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
    Layout,
    Menu,
    Button,
    Table,
    Input,
    Upload,
    message,
    Modal,
    Popconfirm,
    Switch,
    Radio,
    List,
    Card,
    Typography,
    Space,
    Empty,
    Spin,
    Alert,
    Drawer
} from 'antd';
import {
    PlusOutlined,
    UploadOutlined,
    QrcodeOutlined,
    ClearOutlined,
    SyncOutlined,
    DeleteOutlined,
    MenuOutlined,
    UserOutlined,
    LockOutlined
} from '@ant-design/icons';
import {PageContainer} from '@ant-design/pro-layout';
import {QRCodeSVG} from 'qrcode.react';
import jsQR from 'jsqr';
import 'antd/dist/reset.css';
import * as api from './services/api';
import config from './config';
import Cookies from 'js-cookie';

import {useMediaQuery} from 'react-responsive';

const {Header, Content, Footer} = Layout;
const {Dragger} = Upload;
const {Text} = Typography;

const CountdownTimer = React.memo(({onComplete}) => {
    const [countdown, setCountdown] = useState(30);

    useEffect(() => {
        const calculateCountdown = () => {
            const now = Math.floor(Date.now() / 1000);
            return 30 - (now % 30);
        };

        const timer = setInterval(() => {
            const newCountdown = calculateCountdown();
            setCountdown(newCountdown);
            if (newCountdown === 30) {
                onComplete();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [onComplete]);

    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const dashoffset = circumference * (1 - countdown / 30);

    return (
        <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r={radius} fill="none" stroke="#e6e6e6" strokeWidth="4"/>
            <circle
                cx="20"
                cy="20"
                r={radius}
                fill="none"
                stroke="#1890ff"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={dashoffset}
                transform="rotate(-90 20 20)"
            />
            <text x="20" y="20" textAnchor="middle" dy=".3em" fontSize="12">
                {countdown}
            </text>
        </svg>
    );
});

function App() {
    const [totps, setTotps] = useState([]);
    const [userInfo, setUserInfo] = useState('');
    const [secret, setSecret] = useState('');
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [currentQR, setCurrentQR] = useState('');
    const [tokens, setTokens] = useState({});
    const [syncEnabled, setSyncEnabled] = useState(false);
    const [backupMode, setBackupMode] = useState('update');
    const [backupModalVisible, setBackupModalVisible] = useState(false);
    const [backupVersions, setBackupVersions] = useState([]);
    const [restoreModalVisible, setRestoreModalVisible] = useState(false);
    const [isLoadingBackups, setIsLoadingBackups] = useState(false);
    const [importStatus, setImportStatus] = useState({loading: false, count: 0});
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const formatSecret = useCallback((secret) => {
        const cleanSecret = secret.replace(/\s+/g, '');
        return cleanSecret.match(/.{1,4}/g)?.join(' ') || cleanSecret;
    }, []);
    const formattedTotps = useMemo(() =>
            totps.map(totp => ({
                ...totp,
                formattedSecret: formatSecret(totp.secret)
            })),
        [totps, formatSecret]
    );
    const handleRegister = useCallback(async () => {
        if (!username ||!password) {
            message.warning('用户名和密码不能为空');
            return;
        }
        try {
            const response = await api.register(username, password);
            if (response.status === 201) {
                // 如果注册后后端返回会话令牌，也进行保存
                Cookies.set('sessionToken', response.data.token);
                message.success('注册成功');
                setIsRegistering(false);
            } else {
                throw new Error(response.data.error || '注册失败');
            }
        } catch (error) {
            if (error.response && error.response.data && error.response.data.error === 'Username already exists. Please choose a different one.') {
                message.error('用户名已存在，请选择其他用户名进行注册。');
            } else {
                console.error('注册失败:', error);
                message.error('注册失败: ' + error.message);
            }
        }
    }, [username, password]);

    const handleLogin = useCallback(async () => {
        if (!username ||!password) {
            message.warning('用户名和密码不能为空');
            return;
        }
        try {
            const response = await api.login(username, password);
            if (response.status === 200) {
                Cookies.set('sessionToken', response.data.token);
                setIsLoggedIn(true);
                message.success('登录成功');
            } else {
                throw new Error(response.data.error || '登录失败');
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                message.error('用户名或密码错误');
            } else if (error.response && error.response.data && error.response.data.error === 'Invalid username. User not found.') {
                message.error('用户名不存在，请检查输入或进行注册。');
            } else {
                console.error('登录失败:', error);
                message.error('登录失败: ' + error.message);
            }
        }
    }, [username, password]);
    const handleLogout = useCallback(async () => {
        try {
            await api.logout();
            Cookies.remove('sessionToken');
            setIsLoggedIn(false);
            setTotps([]);
            setSyncEnabled(false);
            setUserInfo('');
            setPassword('');
            message.success('已退出登录');
        } catch (error) {
            console.error('退出登录失败:', error);
            message.error('退出登录失败');
        }
    }, []);

    const isDesktopOrLaptop = useMediaQuery({minWidth: 1024});

    const [isLoadingTOTPs, setIsLoadingTOTPs] = useState(false);

    const loadTOTPs = useCallback(async () => {
        if (!isLoggedIn) return;
        try {
            setIsLoadingTOTPs(true);
            const response = await api.getTOTPs();
            setTotps(response.data);
        } catch (error) {
            console.error('加载TOTP列表失败:', error);
            message.error('加载TOTP列表失败');
        } finally {
            setIsLoadingTOTPs(false);
        }
    }, [isLoggedIn]);
    const checkAuthStatus = useCallback(async () => {
        if (!isLoggedIn) return;
        try {
            const response = await api.getGithubAuthStatus();
            if (response.data.isTokenExpired) {
                const confirmResult = window.confirm('GitHub 令牌已过期，是否重新授权？');
                if (confirmResult) {
                    window.location.href = config.GITHUB_AUTH_URL;
                } else {
                    setSyncEnabled(false);
                }
            } else {
                setSyncEnabled(response.data.authenticated);
            }
        } catch (error) {
            console.error('Failed to check GitHub auth status:', error);
        }
    }, [isLoggedIn]);
    const generateToken = useCallback(async (id) => {
        try {
            if (totps.length === 0) {
                message.info('TOTP 列表为空，无法生成令牌。');
                return;
            }
            const response = await api.generateToken(id);
            if (response.data.error) {
                message.error(response.data.error);
            } else {
                setTokens(prev => ({...prev, [id]: response.data.token }));
            }
        } catch (error) {
            console.error('令牌生成失败:', error);
            message.error('令牌生成失败');
        }
    }, [totps]);
    useEffect(() => {
        const token = Cookies.get('sessionToken');
        if (token) {
            setIsLoggedIn(true);
            loadTOTPs();
            checkAuthStatus();
        }
    }, [isLoggedIn,loadTOTPs, checkAuthStatus]);


    useEffect(() => {
        if (!isLoggedIn) return;

        const generateAllTokens = () => {
            totps.forEach(totp => generateToken(totp.id));
        };

        const now = Math.floor(Date.now() / 1000);
        const delay = ((30 - (now % 30)) * 1000) + 50; // 加50毫秒确保我们在新周期开始后生成令牌

        const timeout = setTimeout(() => {
            generateAllTokens();
            const interval = setInterval(generateAllTokens, 30000);
            return () => clearInterval(interval);
        }, delay);

        return () => clearTimeout(timeout);
    }, [isLoggedIn, totps, generateToken]);

    const addTOTP = useCallback(async () => {
        if (!userInfo || !secret) {
            message.warning('用户信息和密钥不能为空');
            return;
        }
        try {
            const processedSecret = secret.replace(/\s+/g, '');
            await api.addTOTP(userInfo, processedSecret);
            message.success('TOTP添加成功');
            await loadTOTPs(); // 刷新列表
            setUserInfo('');
            setSecret('');
        } catch (error) {
            console.error('TOTP添加失败:', error);
            message.error('TOTP添加失败: ' + (error.response?.data?.message || error.message));
        }
    }, [userInfo, secret, loadTOTPs]);

    const deleteTOTP = useCallback(async (id) => {
        try {
            await api.deleteTOTP(id);
            message.success('TOTP删除成功');
            await loadTOTPs();
        } catch (error) {
            console.error('TOTP删除失败:', error);
            message.error('TOTP删除失败');
        }
    }, [loadTOTPs]);


    const showQRCode = useCallback(async (record) => {
        try {
            const response = await api.exportTOTP(record.id);
            console.log('Export response:', response.data);
            if (response.data && response.data.uri) {
                setCurrentQR(response.data.uri);
                setQrModalVisible(true);
            } else {
                throw new Error('Invalid response data: URI not found');
            }
        } catch (error) {
            console.error('Error generating QR code:', error);
            message.error(`Failed to generate QR code: ${error.message}`);
        }
    }, []);

    const downloadQRCode = () => {
        try {
            const svg = document.getElementById("qr-code-canvas");
            if (!svg) {
                throw new Error("QR code SVG not found");
            }
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const pngFile = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.download = "qrcode.png";
                downloadLink.href = pngFile;
                downloadLink.click();
            };
            img.src = "data:image/svg+xml;base64," + btoa(svgData);
            message.success("QR code downloaded successfully");
        } catch (error) {
            console.error("Error downloading QR code:", error);
            message.error(`Failed to download QR code: ${error.message}`);
        }
    };

    const handleSyncToggle = (checked) => {
        if (checked && !syncEnabled) {
            window.location.href = config.GITHUB_AUTH_URL;
        } else {
            setSyncEnabled(checked);
        }
    };

    const showBackupModal = () => {
        setBackupModalVisible(true);
    };

    const handleBackupModalOk = () => {
        setBackupModalVisible(false);
        uploadToGist();
    };

    const handleBackupModalCancel = () => {
        setBackupModalVisible(false);
    };

    const uploadToGist = async () => {
        try {
            await api.uploadToGist(backupMode);
            message.success('数据成功上传到Gist');
        } catch (error) {
            console.error('上传到Gist失败:', error);
            message.error('上传到Gist失败');
        }
    };

    const showRestoreModal = async () => {
        try {
            setIsLoadingBackups(true);
            setRestoreModalVisible(true);
            setBackupVersions([]);
            const response = await api.getGistVersions();
            if (response.data && response.data.length > 0) {
                setBackupVersions(response.data);
            } else {
                console.log('No backup versions found');
            }
        } catch (error) {
            console.error('获取备份版本失败:', error);
            message.error('获取备份版本失败: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsLoadingBackups(false);
        }
    };

    const clearAllTOTPs = async () => {
        try {
            await api.clearAllTOTPs();
            message.success('所有TOTP已清除');
            await loadTOTPs();
            setTokens({});
        } catch (error) {
            console.error('清除所有TOTP失败:', error);
            message.error('清除所有TOTP失败');
        }
    };

    const handleRestoreModalOk = async (gistId) => {
        try {
            await api.restoreFromGist(gistId);
            message.success('数据成功从Gist恢复');
            await loadTOTPs();
            setRestoreModalVisible(false);
        } catch (error) {
            console.error('从Gist恢复数据失败:', error);
            message.error('从Gist恢复数据失败');
        }
    };

    const deleteBackup = async (gistId) => {
        try {
            console.log('Deleting backup with ID:', gistId);
            const response = await api.deleteBackup(gistId);
            console.log('Delete response:', response);

            if (response.status === 200) {
                message.success('备份已成功删除');
                console.log('Fetching updated TOTP list...');
                await loadTOTPs();
                setRestoreModalVisible(false);
            } else {
                throw new Error('删除失败');
            }
        } catch (error) {
            console.error('删除备份失败:', error);
            message.error('删除备份失败: ' + (error.response?.data?.message || error.message));
        }
    };



    const handleQRUpload = async (file) => {
        setImportStatus({loading: true, count: 0});
        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const img = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = dataUrl;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, img.width, img.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                const response = await api.importTOTP(code.data);
                console.log(response)
                if (response.data.success) {
                    setImportStatus({loading: false, count: response.data.count});
                    message.success(`成功导入 ${response.data.count} 个TOTP`);
                    await loadTOTPs(); // 确保这里调用了 loadTOTPs 函数
                } else {
                    throw new Error(response.data.error || 'TOTP导入失败');
                }
            } else {
                throw new Error('无法识别二维码');
            }
        } catch (error) {
            console.error('QR上传错误:', error);
            message.error(error.message || 'TOTP导入过程中发生错误');
            setImportStatus({loading: false, count: 0});
        }
        return false;
    };

    const draggerProps = {
        name: 'file',
        multiple: false,
        accept: 'image/*',
        beforeUpload: handleQRUpload,
        showUploadList: false,
    };

    const columns = useMemo(() => [
        {
            title: '序号',
            key: 'index',
            render: (text, record, index) => index + 1,
            width: 80,
        },
        {
            title: '用户信息',
            dataIndex: 'userInfo',
            key: 'userInfo',
            ellipsis: true,
        },
        {
            title: '密钥',
            dataIndex: 'secret',
            key: 'secret',
            render: (text) => text && text.length > 0 ? <Text copyable>{formatSecret(text)}</Text> : '已清空',
            ellipsis: true,
        },
        {
            title: '令牌',
            key: 'token',
            render: (text, record) => (
                <Space>
                    <Text strong>{tokens[record.id] || '未生成'}</Text>
                    <CountdownTimer onComplete={() => generateToken(record.id)}/>
                </Space>
            ),
        },
        {
            title: '操作',
            key: 'action',
            render: (text, record) => (
                <Space>
                    <Button onClick={() => generateToken(record.id)} type="primary" size="small">
                        生成令牌
                    </Button>
                    <Button onClick={() => showQRCode(record)} size="small" icon={<QrcodeOutlined/>}>
                        导出
                    </Button>
                    <Button onClick={() => deleteTOTP(record.id)} danger size="small">
                        删除
                    </Button>
                </Space>
            ),
        },
    ], [generateToken, showQRCode, deleteTOTP, tokens, formatSecret]);

    const renderContent = () => (
        <PageContainer>
            {isLoggedIn ? (
                // 已登录时显示的内容
                <Card style={{marginTop: 16}}>
                    <Space direction="vertical" size="large" style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{flex: 1}}>
                            <div style={{
                                display: 'flex',
                                flexDirection: isDesktopOrLaptop ? 'row' : 'column',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '16px'
                            }}>
                                <Space direction={isDesktopOrLaptop ? 'horizontal' : 'vertical'}
                                       style={{width: isDesktopOrLaptop ? 'auto' : '100%'}}>
                                    <Input
                                        placeholder="用户信息"
                                        value={userInfo}
                                        onChange={(e) => setUserInfo(e.target.value)}
                                        style={{width: isDesktopOrLaptop ? 200 : '100%'}}
                                    />
                                    <Input
                                        placeholder="密钥"
                                        value={secret}
                                        onChange={(e) => setSecret(formatSecret(e.target.value))}
                                        style={{width: isDesktopOrLaptop ? 200 : '100%'}}
                                    />
                                    <Button type="primary" onClick={addTOTP} icon={<PlusOutlined/>}
                                            style={{width: isDesktopOrLaptop ? 'auto' : '100%'}}>
                                        添加
                                    </Button>
                                </Space>
                                <Space direction={isDesktopOrLaptop ? 'horizontal' : 'vertical'}
                                       style={{width: isDesktopOrLaptop ? 'auto' : '100%'}}>
                                    <Switch
                                        checked={syncEnabled}
                                        onChange={handleSyncToggle}
                                        checkedChildren="同步开启"
                                        unCheckedChildren="同步关闭"
                                    />
                                    {syncEnabled && (
                                        <>
                                            <Button onClick={showBackupModal} icon={<UploadOutlined/>}
                                                    style={{width: isDesktopOrLaptop ? 'auto' : '100%'}}>
                                                上传
                                            </Button>
                                            <Button onClick={showRestoreModal} icon={<SyncOutlined/>}
                                                    style={{width: isDesktopOrLaptop ? 'auto' : '100%'}}>
                                                恢复
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        onClick={() => Modal.confirm({
                                            title: '确认清除所有 TOTP？',
                                            content: '此操作将删除所有已添加的 TOTP，不可恢复。',
                                            onOk: clearAllTOTPs,
                                            okText: '确认',
                                            cancelText: '取消',
                                        })}
                                        icon={<ClearOutlined/>}
                                        danger
                                        style={{width: isDesktopOrLaptop ? 'auto' : '100%'}}
                                    >
                                        清除所有
                                    </Button>
                                </Space>
                            </div>
                            <Dragger {...draggerProps}>
                                <p className="ant-upload-drag-icon">
                                    <QrcodeOutlined/>
                                </p>
                                <p className="ant-upload-text">点击或拖拽二维码图片到此区域以导入 TOTP</p>
                            </Dragger>
                            {importStatus.loading && (
                                <div style={{textAlign: 'center', marginTop: '10px'}}>
                                    <Spin tip="正在导入 TOTP..."/>
                                </div>
                            )}
                            {importStatus.count > 0 && (
                                <div style={{textAlign: 'center', marginTop: '10px'}}>
                                    <Alert
                                        message={`成功导入 ${importStatus.count} 个 TOTP`}
                                        type="success"
                                        showIcon
                                    />
                                </div>
                            )}
                            <Table
                                columns={columns}
                                dataSource={formattedTotps}
                                rowKey="id"
                                locale={{
                                    emptyText: 'TOTP 列表为空'
                                }}
                                pagination={{pageSize: 10}}
                                scroll={{x: 'max-content'}}
                                loading={isLoadingTOTPs}
                            />
                        </div>
                        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                            <Button type="danger" onClick={handleLogout} style={{
                                backgroundColor: '#ff4d4f',
                                color: 'white',
                                border: 'none',
                                marginLeft: '8px'
                            }}>退出登录</Button>
                        </div>
                    </Space>
                </Card>
            ) : isRegistering ? (
                // 注册页面内容
                <Card style={{
                    marginTop: 16,
                    backgroundColor: '#f5f5f5',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    maxWidth: '300px',
                    margin: '0 auto'
                }}>
                    <Input
                        placeholder="用户名"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{width: '100%', marginBottom: '12px'}}
                        prefix={<UserOutlined style={{color: '#1890ff'}}/>}
                    />
                    <Input.Password
                        placeholder="密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{width: '100%', marginBottom: '16px'}}
                        prefix={<LockOutlined style={{color: '#1890ff'}}/>}
                    />
                    <Button type="primary" style={{width: '100%'}} onClick={handleRegister}>注册</Button>
                </Card>
            ) : (
                // 登录页面内容
                <Card style={{
                    marginTop: 16,
                    backgroundColor: '#f5f5f5',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    maxWidth: '300px',
                    margin: '0 auto'
                }}>
                    <Input
                        placeholder="用户名"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{width: '100%', marginBottom: '12px'}}
                        prefix={<UserOutlined style={{color: '#1890ff'}}/>}
                    />
                    <Input.Password
                        placeholder="密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{width: '100%', marginBottom: '16px'}}
                        prefix={<LockOutlined style={{color: '#1890ff'}}/>}
                    />
                    <Button type="primary" style={{width: '100%'}} onClick={handleLogin}>登录</Button>
                    <Button style={{width: '100%', marginTop: '8px'}}
                            onClick={() => setIsRegistering(true)}>注册</Button>
                </Card>
            )}
        </PageContainer>
    );

    return (
        <Layout style={{minHeight: '100vh'}}>
            {isDesktopOrLaptop ? (
                <>
                    <Header style={{display: 'flex', alignItems: 'center'}}>
                        <div className="logo"
                             style={{color: 'white', fontSize: '18px', fontWeight: 'bold', marginRight: '20px'}}>
                            TOTP Token Manager
                        </div>
                        <Menu theme="dark" mode="horizontal" defaultSelectedKeys={['1']} style={{flex: 1}}>
                            <Menu.Item key="1">主页</Menu.Item>
                        </Menu>
                    </Header>
                    <Content style={{padding: '0 50px'}}>
                        {renderContent()}
                    </Content>
                </>
            ) : (
                <>
                    <Header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div className="logo" style={{color: 'white', fontSize: '16px', fontWeight: 'bold'}}>
                            TOTP Token Manager
                        </div>
                        <Button type="primary" onClick={() => setDrawerVisible(true)} icon={<MenuOutlined/>}/>
                    </Header>
                    <Content style={{padding: '16px'}}>
                        {renderContent()}
                    </Content>
                    <Drawer
                        title="菜单"
                        placement="left"
                        onClose={() => setDrawerVisible(false)}
                        open={drawerVisible}
                    >
                        <Menu mode="inline" defaultSelectedKeys={['1']}>
                            <Menu.Item key="1" icon={<QrcodeOutlined/>}>
                                TOTP管理
                            </Menu.Item>
                        </Menu>
                    </Drawer>
                </>
            )}
            <Footer style={{textAlign: 'center'}}>
                TOTP Token Manager ©{new Date().getFullYear()} Created by Lones
            </Footer>

            <Modal
                title="TOTP 二维码"
                open={qrModalVisible}
                onCancel={() => setQrModalVisible(false)}
                footer={[
                    <Button key="download" type="primary" onClick={downloadQRCode}>
                        下载二维码
                    </Button>,
                    <Button key="close" onClick={() => setQrModalVisible(false)}>
                        关闭
                    </Button>,
                ]}
            >
                {currentQR ? (
                    <QRCodeSVG
                        id="qr-code-canvas"
                        value={currentQR}
                        size={256}
                        level={'H'}
                        includeMargin={true}
                    />
                ) : (
                    <p>无法生成二维码：未找到有效的 URI</p>
                )}
            </Modal>

            <Modal
                title="选择备份模式"
                open={backupModalVisible}
                onOk={handleBackupModalOk}
                onCancel={handleBackupModalCancel}
            >
                <Radio.Group onChange={(e) => setBackupMode(e.target.value)} value={backupMode}>
                    <Radio value="update">更新现有备份</Radio>
                    <Radio value="create">创建新备份</Radio>
                </Radio.Group>
            </Modal>

            <Modal
                title="选择要恢复的备份版本"
                open={restoreModalVisible}
                onCancel={() => setRestoreModalVisible(false)}
                footer={null}
            >
                {isLoadingBackups ? (
                    <div style={{textAlign: 'center', padding: '20px'}}>
                        <Spin tip="加载备份版本中..."/>
                    </div>
                ) : backupVersions.length > 0 ? (
                    <List
                        dataSource={backupVersions}
                        renderItem={item => (
                            <List.Item
                                actions={[
                                    <Button onClick={() => handleRestoreModalOk(item.id)}>恢复此版本</Button>,
                                    <Popconfirm
                                        title="确定要删除这个备份吗？"
                                        onConfirm={() => deleteBackup(item.id)}
                                        okText="是"
                                        cancelText="否"
                                    >
                                        <Button danger icon={<DeleteOutlined/>}>删除</Button>
                                    </Popconfirm>
                                ]}
                            >
                                <List.Item.Meta
                                    title={item.description}
                                    description={`创建于: ${item.created_at}, 更新于: ${item.updated_at}`}
                                />
                            </List.Item>
                        )}
                    />
                ) : (
                    <Empty
                        description="没有可用的备份"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                        <Button type="primary" onClick={() => setRestoreModalVisible(false)}>关闭</Button>
                    </Empty>
                )}
            </Modal>
        </Layout>
    );
}

export default App;
