import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { seedInitialData } from '../lib/seeding';
import { useAuth } from '../context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { EventDay, School as SchoolType, Announcement } from '../types';
import Navbar from '../components/Navbar';
import RobotAssistant from '../components/RobotAssistant';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Clock, Award, ShieldAlert, CheckCircle, 
  ChevronRight, Users, School, ArrowRight, Sparkles, BookOpen, 
  MapPin, Phone, Mail, HelpCircle, Database, AlertTriangle, Youtube
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const directLoginId = searchParams.get('login')?.trim();
  const isSoloParam = searchParams.get('solo') === 'true';
  
  // Firestore Data lists
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [eventDays, setEventDays] = useState<EventDay[]>([]);
  const [schoolsList, setSchoolsList] = useState<SchoolType[]>([]);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');

  // Derived dynamic stats calculated pure/synchronously on every render to prevent timing and async database call issues
  const totalSchools = schoolsList.length;
  const approvedSchools = schoolsList.filter((s: any) => s.status === 'approved');
  const totalApproved = approvedSchools.length;

  let schoolParticipants = 0;
  approvedSchools.forEach(s => {
    schoolParticipants += (s.expectedStudents || 0) + (s.expectedTeachers || 0);
  });

  let totalCap = 0;
  let internalReserved = 0;
  eventDays.forEach((d: any) => {
    totalCap += (d.capacity || 0);
    internalReserved += (d.reservedSeats || 0);
  });

  const totalParticipants = schoolParticipants + internalReserved;
  const capacityUsed = totalCap > 0 ? Math.round((totalParticipants / totalCap) * 100) : 70;
  const remainingCapacity = Math.max(0, totalCap - totalParticipants);

  // Compute real RSVP response rate
  const rsvped = approvedSchools.filter((s: any) => s.preferredDay && s.arrivalTime).length;
  const attendanceEst = totalApproved > 0 ? Math.round((rsvped / totalApproved) * 100) : 100;

  // Add combinedReserved dynamically to eventDays on render
  const displayEventDays = eventDays.map(d => {
    let dayParticipants = 0;
    approvedSchools.forEach(s => {
      if (s.preferredDay === d.name) {
        dayParticipants += (s.expectedStudents || 0) + (s.expectedTeachers || 0);
      }
    });
    return {
      ...d,
      combinedReserved: (d.reservedSeats || 0) + dayParticipants
    };
  });

  // Auth / Login Simulation for Coordinators
  const [regIdInput, setRegIdInput] = useState('');
  const [coordinatorError, setCoordinatorError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(!!directLoginId);

  // Seeding trigger
  useEffect(() => {
    seedInitialData();
  }, []);

  // Fetch Stats and Announcements
  useEffect(() => {
    // Read announcements
    const unsubAnn = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAnnouncements(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });

    // Read Event Days
    const unsubDays = onSnapshot(collection(db, 'eventDays'), (snapshot) => {
      const days = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventDay));
      setEventDays(days);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'eventDays');
    });

    // Read Schools to compute statistics
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const schools = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolType));
      setSchoolsList(schools);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });

    return () => {
      unsubAnn();
      unsubDays();
      unsubSchools();
    };
  }, []);

  // Countdown timer to SciVerse (July 22, 2026)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const targetDate = new Date('2026-07-22T09:00:00').getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        clearInterval(interval);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Google Login for Admin
  const handleAdminGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email?.toLowerCase();
      
      let isUserAdmin = email === "rameshnathankaruvoolan10@gmail.com";
      if (!isUserAdmin && email) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', email));
          isUserAdmin = adminDoc.exists();
        } catch (e) {
          console.error("Error checking admin doc:", e);
        }
      }

      if (isUserAdmin) {
        navigate('/admin');
      } else {
        // If not explicit admin, we check if they are registered as a school email
        const q = query(collection(db, 'schools'), where('email', '==', result.user.email));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const schoolDoc = querySnap.docs[0];
          localStorage.setItem('schoolSessionId', schoolDoc.id);
          navigate('/dashboard');
        } else {
          // General registration coordinator, direct them to dashboard (or let them register first)
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (directLoginId) {
      // Clear previous session to ensure clean login
      localStorage.removeItem('schoolSessionId');
      localStorage.removeItem('isSoloSession');
      localStorage.removeItem('schoolRegId');

      const handleDirectLogin = async () => {
        setIsLoggingIn(true);
        setCoordinatorError('');
        try {
          // First attempt with the suggested collection
          let collectionName = isSoloParam ? 'soloStudents' : 'schools';
          let docRef = doc(db, collectionName, directLoginId);
          let docSnap = await getDoc(docRef);
          let finalDoc = null;

          if (docSnap.exists()) {
            finalDoc = docSnap;
          } else {
            // If not found and it was supposed to be a school, try solo (and vice versa)
            const fallbackCollection = isSoloParam ? 'schools' : 'soloStudents';
            docRef = doc(db, fallbackCollection, directLoginId);
            docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              finalDoc = docSnap;
              collectionName = fallbackCollection;
            }
          }

          // If still not found by direct document ID, check if directLoginId is actually a Registration ID (case-insensitive)
          if (!finalDoc) {
            const directUpper = directLoginId.toUpperCase();
            
            // Query schools collection by registrationId
            const qSchoolReg = query(collection(db, 'schools'), where('registrationId', '==', directUpper));
            const snapSchoolReg = await getDocs(qSchoolReg);
            if (!snapSchoolReg.empty) {
              finalDoc = snapSchoolReg.docs[0];
              collectionName = 'schools';
            } else {
              // Query soloStudents collection by registrationId
              const qSoloReg = query(collection(db, 'soloStudents'), where('registrationId', '==', directUpper));
              const snapSoloReg = await getDocs(qSoloReg);
              if (!snapSoloReg.empty) {
                finalDoc = snapSoloReg.docs[0];
                collectionName = 'soloStudents';
              }
            }
          }

          if (finalDoc) {
            const data = finalDoc.data();
            if (data.status === 'rejected') {
              setCoordinatorError('This registration has been declined. Please contact support.');
              setIsLoggingIn(false);
            } else {
              const isActuallySolo = collectionName === 'soloStudents';
              localStorage.setItem('schoolSessionId', finalDoc.id);
              localStorage.setItem('isSoloSession', isActuallySolo ? 'true' : 'false');
              localStorage.setItem('schoolRegId', data.registrationId || finalDoc.id);
              
              // Success! Clear the query params and navigate
              navigate('/dashboard', { replace: true });
            }
          } else {
            console.error('Direct login ID not found in either collection:', directLoginId);
            setCoordinatorError('Invalid direct login link. Your record could not be found.');
            setIsLoggingIn(false);
          }
        } catch (err) {
          console.error('Direct login error:', err);
          setCoordinatorError('Connection error during automatic login. Please try again.');
          setIsLoggingIn(false);
        }
      };
      handleDirectLogin();
    }
  }, [directLoginId, isSoloParam, navigate]);

  // If auto-login is active, show a splash screen
  if (directLoginId && isLoggingIn && !coordinatorError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 mb-8 relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-full h-full border-4 border-blue-500/20 border-t-blue-500 rounded-full"
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <h2 className="text-2xl font-black text-white tracking-tight">Authenticating...</h2>
          <p className="text-slate-400 font-mono text-sm">Please wait while we verify your secure access portal.</p>
          <div className="flex items-center justify-center gap-2 pt-4">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
          </div>
        </motion.div>
      </div>
    );
  }

  // School Coordinator login with ID or Email
  const handleSchoolLogin = async (e: FormEvent) => {
    e.preventDefault();
    setCoordinatorError('');
    setIsLoggingIn(true);

    const inputVal = regIdInput.trim();
    if (!inputVal) {
      setCoordinatorError('Please enter your School/Student ID or registered email.');
      setIsLoggingIn(false);
      return;
    }

    try {
      const inputLower = inputVal.toLowerCase();
      const inputUpper = inputVal.toUpperCase();

      // Check multiple matching strategies
      const qRegId = query(collection(db, 'schools'), where('registrationId', '==', inputUpper));
      const qEmailLower = query(collection(db, 'schools'), where('email', '==', inputLower));
      const qEmailRaw = query(collection(db, 'schools'), where('email', '==', inputVal));
      const qTeacherEmailLower = query(collection(db, 'schools'), where('teacherInChargeEmail', '==', inputLower));
      const qTeacherEmailRaw = query(collection(db, 'schools'), where('teacherInChargeEmail', '==', inputVal));
      
      // Check Solo Students too
      const qSoloRegId = query(collection(db, 'soloStudents'), where('registrationId', '==', inputUpper));
      const qSoloEmailLower = query(collection(db, 'soloStudents'), where('email', '==', inputLower));
      const qSoloEmailRaw = query(collection(db, 'soloStudents'), where('email', '==', inputVal));

      const [
        snapRegId, 
        snapEmailLower, 
        snapEmailRaw, 
        snapTeacherEmailLower, 
        snapTeacherEmailRaw, 
        snapSoloRegId, 
        snapSoloEmailLower,
        snapSoloEmailRaw
      ] = await Promise.all([
        getDocs(qRegId),
        getDocs(qEmailLower),
        getDocs(qEmailRaw),
        getDocs(qTeacherEmailLower),
        getDocs(qTeacherEmailRaw),
        getDocs(qSoloRegId),
        getDocs(qSoloEmailLower),
        getDocs(qSoloEmailRaw)
      ]);

      let schoolDoc = null;
      let isSolo = false;

      if (!snapRegId.empty) {
        schoolDoc = snapRegId.docs[0];
      } else if (!snapEmailLower.empty) {
        schoolDoc = snapEmailLower.docs[0];
      } else if (!snapEmailRaw.empty) {
        schoolDoc = snapEmailRaw.docs[0];
      } else if (!snapTeacherEmailLower.empty) {
        schoolDoc = snapTeacherEmailLower.docs[0];
      } else if (!snapTeacherEmailRaw.empty) {
        schoolDoc = snapTeacherEmailRaw.docs[0];
      } else if (!snapSoloRegId.empty) {
        schoolDoc = snapSoloRegId.docs[0];
        isSolo = true;
      } else if (!snapSoloEmailLower.empty) {
        schoolDoc = snapSoloEmailLower.docs[0];
        isSolo = true;
      } else if (!snapSoloEmailRaw.empty) {
        schoolDoc = snapSoloEmailRaw.docs[0];
        isSolo = true;
      } else {
        // Final fallback: check if input is a direct Document ID
        try {
          const directSchoolRef = doc(db, 'schools', inputVal);
          const directSchoolSnap = await getDoc(directSchoolRef);
          if (directSchoolSnap.exists()) {
            schoolDoc = directSchoolSnap;
            isSolo = false;
          } else {
            const directSoloRef = doc(db, 'soloStudents', inputVal);
            const directSoloSnap = await getDoc(directSoloRef);
            if (directSoloSnap.exists()) {
              schoolDoc = directSoloSnap;
              isSolo = true;
            }
          }
        } catch (e) {
          // Ignore error, probably not a valid ID format for direct check
        }
      }

      if (!schoolDoc) {
        setCoordinatorError('Invalid credentials. No registered school or solo participant matches this ID or Email.');
      } else {
        const schoolDocData = schoolDoc.data();
        if (schoolDocData.status === 'rejected') {
          setCoordinatorError('This registration has been declined. Please reach out to administrators.');
        } else {
          localStorage.setItem('schoolSessionId', schoolDoc.id);
          localStorage.setItem('isSoloSession', isSolo ? 'true' : 'false');
          localStorage.setItem('schoolRegId', schoolDocData.registrationId || schoolDoc.id);
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      setCoordinatorError('Error connecting to the database. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden relative">
      {/* Visual background glows */}
      <div className="absolute top-20 left-20 w-[450px] h-[450px] bg-blue-600/10 rounded-full filter blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-40 right-10 w-[350px] h-[350px] bg-indigo-600/10 rounded-full filter blur-[120px] pointer-events-none z-0"></div>

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 relative z-10 py-8 space-y-16">
        
        {/* HERO SECTION */}
        <div className="grid lg:grid-cols-12 gap-12 items-center pt-4">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-mono tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" /> Science Union . Jaffna Hindu College
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              SciVerse <span className="text-blue-500 bg-clip-text">2K26</span> <br />
              <span className="text-slate-300 font-light text-3xl sm:text-4xl lg:text-5xl">Schools and Students Registration and RSVP</span>
            </h1>
            
            <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
              This is a science practical camp for GCE O/L students in Sri Lanka. Specially connected with over 200+ practicals. Also available for beginners A/L students.
            </p>

            {/* Countdown Widget */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-md backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.2)]"
            >
              <p className="text-xs text-blue-400 font-mono tracking-widest uppercase mb-2">Event Countdown</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-2xl font-bold font-mono text-white">{timeLeft.days}</span>
                  <p className="text-[9px] text-slate-400 uppercase">Days</p>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-2xl font-bold font-mono text-white">{timeLeft.hours}</span>
                  <p className="text-[9px] text-slate-400 uppercase">Hours</p>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-2xl font-bold font-mono text-white">{timeLeft.minutes}</span>
                  <p className="text-[9px] text-slate-400 uppercase">Mins</p>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-2xl font-bold font-mono text-white">{timeLeft.seconds}</span>
                  <p className="text-[9px] text-slate-400 uppercase">Secs</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap gap-4 pt-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/register')}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 text-sm shadow-[0_4px_20px_rgba(59,130,246,0.4)] transition cursor-pointer"
              >
                Start Registration <ArrowRight className="w-4 h-4" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const element = document.getElementById('portal-login');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium border border-white/10 transition text-sm cursor-pointer"
              >
                Access Portal
              </motion.button>
            </motion.div>
          </motion.div>

          {/* LOGIN PANES & SYSTEM QUICK ACCESS */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            id="portal-login" 
            className="lg:col-span-5 relative z-20"
          >
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <School className="w-5 h-5 text-blue-400" />
                  School & Student Portal
                </h2>
                <p className="text-xs text-slate-400">Approved schools and students can manage participants & RSVP here</p>
              </div>

              {/* Coordinator ID Login Form */}
              <form onSubmit={handleSchoolLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                    SCHOOL/STUDENT ID OR REGISTERED EMAIL
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Registration ID (e.g., SV26-S-XXXX) or registered email"
                    value={regIdInput}
                    onChange={e => setRegIdInput(e.target.value)}
                    className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 font-mono"
                  />
                </div>

                {coordinatorError && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {coordinatorError}
                  </p>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition cursor-pointer"
                >
                  {isLoggingIn ? 'Verifying Credentials...' : 'Verify & Enter Portal'}
                </motion.button>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-mono uppercase">OR ORGANIZERS</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              {/* Organizer Login with Google */}
              <div className="space-y-2">
                <button
                  onClick={handleAdminGoogleLogin}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.12.57 4.3 1.7l3.21-3.2C17.56 1.72 14.95 1 12 1 7.35 1 3.42 3.68 1.54 7.6l3.85 2.99C6.31 7.15 8.94 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.71-2.36 3.55v2.95h3.81c2.23-2.05 3.6-5.07 3.6-8.61z" />
                    <path fill="#FBBC05" d="M5.39 14.79c-.24-.72-.37-1.49-.37-2.29s.13-1.57.37-2.29L1.54 7.6C.56 9.56 0 11.72 0 14s.56 4.44 1.54 6.4l3.85-2.99c-.24-.71-.37-1.48-.37-2.29z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.81-2.95c-1.06.71-2.42 1.13-4.15 1.13-3.06 0-5.69-2.11-6.61-5.55L1.54 15.7C3.42 19.62 7.35 23 12 23z" />
                  </svg>
                  Admin & Coordinator SSO Sign-In
                </button>
                <p className="text-[10px] text-slate-500 text-center font-mono leading-relaxed">
                  Google sign-in automatically maps to your role based on registered email domain.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* METRICS & SYSTEM SNAPSHOT */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)] hover:bg-white/10 transition-colors">
            <div className="flex justify-between items-start mb-2 text-slate-400">
              <span className="text-xs sm:text-sm">Delegated Schools</span>
              <School className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
              {totalApproved}<span className="text-sm font-normal text-slate-500">/{totalSchools}</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">Approved / Enrolled</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)] hover:bg-white/10 transition-colors">
            <div className="flex justify-between items-start mb-2 text-slate-400">
              <span className="text-xs sm:text-sm">Total Participants</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-mono text-white">{totalParticipants}</h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">Students & Teachers</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)] hover:bg-white/10 transition-colors">
            <div className="flex justify-between items-start mb-2 text-slate-400">
              <span className="text-xs sm:text-sm">Attendance Forecast</span>
              <Award className="w-4 h-4 text-green-400" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-mono text-green-400">{attendanceEst}%</h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">AI Optimism Index</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)] hover:bg-white/10 transition-colors">
            <div className="flex justify-between items-start mb-2 text-slate-400">
              <span className="text-xs sm:text-sm">Seating Capacities</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
              {capacityUsed}%<span className="text-xs text-slate-500"> allocated</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">All days aggregated</p>
          </div>
        </motion.div>

        {/* RECAP VIDEO SECTION */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4"
        >
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
              <Youtube className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                Recap : Sciverse 2K25
              </h2>
              <p className="text-xs text-slate-400">Relive the highlights and pure scientific brilliance from our previous year's event</p>
            </div>
          </div>
          <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-slate-950 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <iframe
              src="https://www.youtube.com/embed/0HfsSQlgY_Q?autoplay=1&mute=1&loop=1&playlist=0HfsSQlgY_Q&controls=0"
              title="Recap : Sciverse 2K25"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </motion.div>

        {/* VERIFIED SCHOOLS BOARD */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <School className="w-6 h-6 text-blue-400" />
                Verified School Delegations
              </h2>
              <p className="text-xs text-slate-400">Roll of approved delegations attending SciVerse 2K26</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <input 
                type="text"
                placeholder="Search approved schools..."
                value={schoolSearchQuery}
                onChange={e => setSchoolSearchQuery(e.target.value)}
                className="bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 font-mono w-full sm:w-60"
              />
              <div className="text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-2 rounded-lg shrink-0 text-center">
                {schoolsList.filter((s: any) => s.status === 'approved').length} APPROVED SCHOOLS
              </div>
            </div>
          </div>

          {schoolsList.filter((s: any) => s.status === 'approved').length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-mono">
              No approved school delegations yet. Submit yours in the Schools and Students Registration tab!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
              {schoolsList
                .filter((s: any) => s.status === 'approved')
                .filter((s: any) => {
                  const queryStr = `${s.name} ${s.registrationId || ''}`.toLowerCase();
                  return queryStr.includes(schoolSearchQuery.toLowerCase());
                })
                .map((school: any) => (
                  <div 
                    key={school.id} 
                    className="p-4 bg-slate-900/60 border border-white/5 rounded-xl flex items-center gap-4 hover:border-blue-500/30 transition-all shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center p-1">
                      <img 
                        src={school.logoUrl || 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200'} 
                        alt="Logo" 
                        className="w-full h-full object-cover rounded-md" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate" title={school.name}>{school.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-blue-400 font-mono tracking-wider font-bold">{school.registrationId || 'APPROVED'}</span>
                        <span className="text-[8px] bg-green-500/15 text-green-400 px-1.5 py-0.2 rounded font-bold font-mono">CONFIRMED</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-1">{school.preferredDay}</p>
                    </div>
                  </div>
                ))}
              {schoolsList
                .filter((s: any) => s.status === 'approved')
                .filter((s: any) => {
                  const queryStr = `${s.name} ${s.registrationId || ''}`.toLowerCase();
                  return queryStr.includes(schoolSearchQuery.toLowerCase());
                }).length === 0 && (
                  <div className="col-span-full text-center py-8 text-slate-400 text-xs font-mono">
                    No matching approved schools found for "{schoolSearchQuery}".
                  </div>
                )}
            </div>
          )}
        </motion.div>

        {/* LIVE BROADCASTS & EVENT TIMELINES */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="grid lg:grid-cols-12 gap-8"
        >
          
          {/* ANNOUNCEMENT BOARD */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Recent News & Broadcasts</h2>
                <p className="text-xs text-slate-400">Live system reminders & schedule adjustments</p>
              </div>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded font-mono uppercase">
                Active Broadcast Feed
              </span>
            </div>

            <div className="space-y-4">
              {announcements.length === 0 ? (
                <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-sm text-slate-400">No active system broadcasts.</p>
                </div>
              ) : (
                announcements.map((ann, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={ann.id}
                    className="p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-colors flex gap-4"
                  >
                    <div className="pt-1">
                      {ann.category === 'alert' && (
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                      )}
                      {ann.category === 'schedule' && (
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 text-yellow-400">
                          <Clock className="w-4 h-4" />
                        </div>
                      )}
                      {ann.category === 'info' && (
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                          <BookOpen className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="text-sm font-bold text-white">{ann.title}</h4>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {new Date(ann.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{ann.content}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* EVENTS CALENDAR */}
          <div className="lg:col-span-4 space-y-6">
            <div className="border-b border-white/10 pb-4 flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold text-white">Event Schedule</h2>
                <p className="text-xs text-slate-400">Symposium timelines & venue capacities</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-mono">Live Participation</p>
                <p className="text-xl font-bold text-white font-mono">{totalParticipants}</p>
              </div>
            </div>

            <div className="space-y-4">
              {displayEventDays.map((day) => (
                <div key={day.id} className="p-4 bg-slate-900/60 border border-white/5 rounded-xl space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white leading-snug">{day.name}</h4>
                      <p className="text-[10px] text-blue-400 font-mono mt-0.5">{day.date}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 font-bold font-mono uppercase rounded shrink-0 ${
                      day.isOpenForRegistration !== false 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                        : 'bg-slate-500/10 text-slate-400 border border-white/10'
                    }`}>
                      {day.isOpenForRegistration !== false ? 'Open' : 'Launch Day'}
                    </span>
                  </div>
                  
                  {day.description && (
                    <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.02] p-2 rounded-lg border border-white/5 font-sans">
                      {day.description}
                    </p>
                  )}
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>General Seating Capacity</span>
                      <span className="font-mono text-white font-bold">{day.capacity} Seats</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Seats Reserved / Registered</span>
                      <span className="font-mono text-blue-400 font-bold">{day.combinedReserved || day.reservedSeats} / {day.capacity}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, ((day.combinedReserved || day.reservedSeats) / day.capacity) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* QUICK CONTACTS */}
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold font-mono text-blue-400 uppercase tracking-wider">Science Union Secretariat</h4>
              
              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Jaffna Hindu College, Jaffna, Sri Lanka</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>+94 77 420 1942</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>scienceunionjhc@gmail.com</span>
                </div>
              </div>
            </div>

          </div>

        </motion.div>

      </main>

      <footer className="mt-auto border-t border-white/10 bg-slate-950 px-6 py-6 text-center text-xs text-slate-500 relative z-10 flex flex-col sm:flex-row justify-between items-center gap-4 max-w-7xl w-full mx-auto">
        <div className="flex gap-6">
          <p className="uppercase tracking-widest text-[10px] text-slate-500">
            System Status: <span className="text-green-400">Online</span>
          </p>
          <p className="uppercase tracking-widest text-[10px] text-slate-500">
            Cloud Datastore: <span className="text-blue-400">Synced</span>
          </p>
        </div>
        <p className="text-xs text-slate-400">A Google Developer Groups Keen Project</p>
        <p>© 2026 Jaffna Hindu College Science Union • SciVerse Development Secretariat</p>
      </footer>

      {/* Floating Assistant Chatbot */}
      <RobotAssistant />
    </div>
  );
}
