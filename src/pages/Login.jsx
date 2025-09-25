import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import WelcomeModal from '../components/WelcomeModal';
import './Login.css';
import loginpageimage from '../images/4957136.jpg';
import brandLogo from '../images/Logo.png';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            
            if (email.toLowerCase().trim() === 'shareit@gmail.com') {
                setShowWelcome(true);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            showToast('Login successful!', 'success');
            navigate('/');
        } catch (error) {
            console.error('Login error:', error);
            setError('Invalid credentials');
            showToast('Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (showWelcome) {
            const timer = setTimeout(() => {
                setShowWelcome(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showWelcome]);

    return (
        <>
            <div className="login-page">
                <div className="row g-0 h-100">
                    <div className="col-md-6">
                        <div className="login-container">
                            <div className="brand-logo-container mb-4">
                                <img src={brandLogo} alt="Vayubox" className="brand-logo" />
                            </div>
                            <h2>Login to Vayubox</h2>
                            {error && (
                                <div className="alert alert-danger">{error}</div>
                            )}
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <div id="recaptcha-container" className="mb-3"></div>
                                </div>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary w-100 mb-2"
                                    disabled={loading}
                                >
                                    {loading ? 'Logging in...' : 'Login'}
                                </button>
                            </form>
                            <div className="mt-3 text-center">
                                <a href="#" id="forgot-password-link">Forgot Password?</a>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="login-image">
                            <img src={loginpageimage} alt="Login Illustration" className="img-fluid" />
                        </div>
                    </div>
                </div>
            </div>
            <WelcomeModal 
                show={showWelcome} 
                onHide={() => setShowWelcome(false)} 
            />
        </>
    );
};

export default Login;
