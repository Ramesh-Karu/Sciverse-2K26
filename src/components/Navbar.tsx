import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { LogOut, Monitor, School, Shield, User, Bell } from 'lucide-react';
import { motion } from 'motion/react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <header className="relative z-50 flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl mx-4 my-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
        <img 
          src="https://i.ibb.co/hJp9jZb4/1000192206-imgupscaler-ai-General-8-K.jpg" 
          alt="SciVerse Icon" 
          className="w-10 h-10 rounded-lg object-cover border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
        />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            SciVerse <span className="text-blue-400 font-mono text-sm px-1.5 py-0.5 bg-blue-500/10 rounded">2K26</span>
          </h1>
          <p className="text-[9px] text-blue-400 font-mono tracking-widest uppercase">
            Jaffna Hindu College • Science Union
          </p>
        </div>
      </div>

      <nav className="hidden md:flex gap-8 items-center">
        <button 
          onClick={() => navigate('/')} 
          className={`text-sm font-medium transition-all ${
            location.pathname === '/' 
              ? 'text-blue-400 border-b-2 border-blue-500 pb-1' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Home
        </button>
        <button 
          onClick={() => navigate('/register')} 
          className={`text-sm font-medium transition-all ${
            location.pathname === '/register' 
              ? 'text-blue-400 border-b-2 border-blue-500 pb-1' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          School Registration
        </button>
        
        {user && (
          <button 
            onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')} 
            className={`text-sm font-medium transition-all ${
              location.pathname.startsWith('/admin') || location.pathname.startsWith('/dashboard')
                ? 'text-blue-400 border-b-2 border-blue-500 pb-1' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {isAdmin ? 'Admin Console' : 'School Portal'}
          </button>
        )}
      </nav>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-white truncate max-w-[150px]">
                {user.displayName || user.email?.split('@')[0]}
              </p>
              <p className="text-[10px] text-blue-400 font-mono flex items-center justify-end gap-1 uppercase">
                {isAdmin ? (
                  <>
                    <Shield className="w-3 h-3 text-red-400" />
                    Super Admin
                  </>
                ) : (
                  <>
                    <School className="w-3 h-3" />
                    Coordinator
                  </>
                )}
              </p>
            </div>
            
            <div className="relative group">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500/50 p-0.5 overflow-hidden bg-slate-800 flex items-center justify-center cursor-pointer">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-blue-400" />
                )}
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="p-2 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-white/5 hover:border-red-500/20"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>
        ) : (
          <div className="flex gap-2">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/register')}
              className="hidden sm:block text-xs font-medium text-slate-300 hover:text-white px-4 py-2"
            >
              Register
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/register?login=true')}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)] transition"
            >
              Portal Login
            </motion.button>
          </div>
        )}
      </div>
    </header>
  );
}
