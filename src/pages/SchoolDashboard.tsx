import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { School, ArrivalSlot, EventDay } from '../types';
import Navbar from '../components/Navbar';
import RobotAssistant from '../components/RobotAssistant';
import { SchoolPassCard } from '../components/StylishCardGenerator';
import { motion } from 'motion/react';
import { 
  Clock, Calendar, Sparkles, ShieldCheck, AlertTriangle, Info, QrCode, Download
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function SchoolDashboard() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  
  // Session details
  const schoolId = localStorage.getItem('schoolSessionId');
  const [school, setSchool] = useState<School | null>(null);
  const [arrivalSlots, setArrivalSlots] = useState<ArrivalSlot[]>([]);
  const [eventDays, setEventDays] = useState<EventDay[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [isDownloadingPass, setIsDownloadingPass] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolId) {
      navigate('/register');
      return;
    }

    // Subscribe to School document
    const unsubSchool = onSnapshot(doc(db, 'schools', schoolId), (docSnap) => {
      if (docSnap.exists()) {
        setSchool({ id: docSnap.id, ...docSnap.data() } as School);
      } else {
        setError('School record not found.');
      }
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `schools/${schoolId}`);
    });

    // Subscribe to supporting data lists
    const unsubSlots = onSnapshot(collection(db, 'arrivalSlots'), (snapshot) => {
      setArrivalSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArrivalSlot)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'arrivalSlots');
    });

    const unsubDays = onSnapshot(collection(db, 'eventDays'), (snapshot) => {
      setEventDays(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventDay)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'eventDays');
    });

    return () => {
      unsubSchool();
      unsubSlots();
      unsubDays();
    };
  }, [schoolId, navigate]);

  // Update schedule preferences
  const handlePrefSave = async (preferredDay: string, arrivalTime: string) => {
    if (!school) return;
    setIsSavingPref(true);
    try {
      await updateDoc(doc(db, 'schools', school.id), {
        preferredDay,
        arrivalTime
      });
      success('Event attendance day and arrival slot successfully synchronized.');
    } catch (err) {
      console.error(err);
      toastError('Error saving preferences.');
    } finally {
      setIsSavingPref(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!school) return;
    setIsDownloadingPass(true);
    try {
      const { generatePassCardDataURL } = await import('../components/StylishCardGenerator');
      const dataUrl = await generatePassCardDataURL({
        id: school.id,
        name: school.name,
        principalName: school.principalName,
        teacherInCharge: school.teacherInCharge,
        teacherInChargeEmail: school.teacherInChargeEmail || '',
        teacherInChargePhone: school.teacherInChargePhone || '',
        contact: school.contact,
        email: school.email,
        preferredDay: school.preferredDay,
        arrivalTime: school.arrivalTime,
        expectedStudents: school.expectedStudents || 0,
        expectedTeachers: school.expectedTeachers || 0,
        status: school.status
      });
      const link = document.createElement('a');
      link.download = `${school.name.replace(/\s+/g, '_')}_SciVerse_2K26_Pass.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      success('High-quality Pass Card downloaded successfully!');
    } catch (err) {
      console.error('Error downloading pass PNG:', err);
      toastError('Error rendering high-quality pass card. Please retry.');
    } finally {
      setIsDownloadingPass(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-t-2 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-400 font-mono">Synchronizing SciVerse Holo-Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans">
        <div className="text-center space-y-4 bg-white/5 p-8 rounded-3xl border border-white/10 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-md font-bold">{error || 'Session Expired or Invalid portal credentials.'}</p>
          <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-blue-600 rounded-xl font-mono text-xs uppercase font-bold cursor-pointer">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const totalAllocated = (school.expectedStudents || 0) + (school.expectedTeachers || 0);
  const quotaLimit = school.quota || 30;
  const quotaPercent = Math.min(100, (totalAllocated / quotaLimit) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden relative">
      {/* Background glow visualizers */}
      <div className="absolute top-0 left-10 w-[400px] h-[400px] bg-blue-600/5 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-20 right-10 w-[300px] h-[300px] bg-indigo-600/5 rounded-full filter blur-[100px] pointer-events-none"></div>

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 relative z-10 py-6 space-y-8">
        
        {school.status === 'pending' && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-amber-300">Registration Under Review</h4>
                <p className="text-xs text-amber-400/80 leading-relaxed max-w-3xl">
                  Your school delegation registration is currently pending review by the SciVerse 2K26 administrative board. 
                  However, you have **full access** to specify preferred arrival times and view your temporary pass. 
                  Your official digital admission QR pass will activate immediately upon final administrative approval.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl shrink-0 text-center">
              PENDING REVIEW
            </span>
          </div>
        )}
        
        {/* UPPER HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-white/10 bg-slate-900/60 p-2 overflow-hidden shrink-0 flex items-center justify-center">
              <img 
                src="https://i.ibb.co/hJp9jZb4/1000192206-imgupscaler-ai-General-8-K.jpg" 
                alt="App Logo" 
                className="w-full h-full object-cover rounded-lg" 
              />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{school.name}</h1>
              <p className="text-xs text-slate-400 font-mono">
                REG ID: <span className="text-blue-400 font-bold tracking-widest">{school.registrationId || `PEN-${school.id.slice(0, 6).toUpperCase()}`}</span> • Science Union . Jaffna Hindu College
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadPNG}
              disabled={isDownloadingPass}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono uppercase flex items-center gap-2 shadow-[0_4px_15px_rgba(59,130,246,0.3)] cursor-pointer"
            >
              {isDownloadingPass ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Generating HD PNG...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download PNG Pass
                </>
              )}
            </button>
            <a
              href="#pass-card-section"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-white/10 rounded-xl text-xs font-bold font-mono uppercase flex items-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" /> View Pass Card
            </a>
          </div>
        </div>

        {/* STATS & SEATING QUOTA MONITOR */}
        <div className="grid md:grid-cols-12 gap-6">
          
          {/* SEATING MONITOR */}
          <div className="md:col-span-8 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-blue-400">Delegation Allocation Quota</h3>
                <p className="text-xs text-slate-400">Total capacity reserved for your school delegation</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-300">
                {totalAllocated} / {quotaLimit} Seats
              </span>
            </div>

            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  quotaPercent >= 100 ? 'bg-red-500' : quotaPercent >= 80 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${quotaPercent}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-400" /> 
                {quotaLimit - totalAllocated} remaining capacity slots available for further requests.
              </span>
              {quotaPercent >= 100 && (
                <span className="text-red-400 font-bold flex items-center gap-1 font-mono">
                  <AlertTriangle className="w-3.5 h-3.5" /> LIMIT REACHED
                </span>
              )}
            </div>
          </div>

          {/* ARRIVAL SCHEDULER */}
          <div className="md:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)] space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-blue-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Arrival Slot Preferences
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Target Event Day</label>
                <select
                  id="preferred-day-select"
                  value={school.preferredDay}
                  onChange={e => handlePrefSave(e.target.value, school.arrivalTime)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white"
                >
                  {eventDays.map((d, dIdx) => (
                    <option key={dIdx} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Gate Arrival Queue</label>
                <select
                  id="arrival-time-select"
                  value={school.arrivalTime}
                  onChange={e => handlePrefSave(school.preferredDay, e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white"
                >
                  {arrivalSlots.map((s, sIdx) => (
                    <option key={sIdx} value={s.time}>{s.time}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* DELEGATION SUMMARY & QR PASS */}
        <div id="pass-card-section" className="grid lg:grid-cols-12 gap-8">
          
          {/* DELEGATION POLICY & SUMMARY DETAILS */}
          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)] space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5.5 h-5.5 text-blue-400" /> Delegation Attendance Allocation
                </h3>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-wider text-blue-400/80">SciVerse 2K26 Institutional Master Pass Policy</p>
              </div>

              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl text-xs text-slate-300 leading-relaxed space-y-3 font-sans">
                <p>
                  <strong>No Student Roster Entry Needed:</strong> SciVerse 2K26 operates on a streamlined <strong>Institutional-Level delegation model</strong>. You are not required to submit or register individual student names or teacher rosters.
                </p>
                <p>
                  The exact number of students and accompanying teachers you specified during registration has been reserved and allocated to your delegation. To enter the O/L Science Practical Camp, your entire delegation will be checked in at the gates under your school's <strong>Master Pass</strong>.
                </p>
                <p>
                  To change your student or teacher allotment counts, please contact the Jaffna Hindu College Science Union organizing committee.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Students Allotment</span>
                  <span className="text-2xl font-black text-blue-400 font-mono">{school.expectedStudents || 0}</span>
                </div>
                <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Teachers Allotment</span>
                  <span className="text-2xl font-black text-indigo-400 font-mono">{school.expectedTeachers || 0}</span>
                </div>
                <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Total Capacity</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">{totalAllocated}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-400 leading-normal">
              <p className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                TIMING PREFERENCE: Preferred {school.preferredDay} @ {school.arrivalTime}
              </p>
            </div>
          </div>

          {/* MASTER QR DELEGATION PASS CARD */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Your Institutional Master Pass</h3>
              <p className="text-xs text-slate-400">Download, print or show this portrait pass at the registration desk</p>
            </div>

            <SchoolPassCard 
              school={{
                id: school.id,
                name: school.name,
                principalName: school.principalName,
                teacherInCharge: school.teacherInCharge,
                teacherInChargeEmail: school.teacherInChargeEmail,
                teacherInChargePhone: school.teacherInChargePhone,
                contact: school.contact,
                email: school.email,
                address: school.address,
                logoUrl: school.logoUrl,
                status: school.status,
                registrationId: school.registrationId,
                expectedStudents: school.expectedStudents,
                expectedTeachers: school.expectedTeachers,
                preferredDay: school.preferredDay,
                arrivalTime: school.arrivalTime,
                specialRequirements: school.specialRequirements,
                quota: school.quota,
                createdAt: school.createdAt
              }} 
              className="w-full"
            />
          </div>

        </div>

      </main>

      <RobotAssistant schoolContext={school} />
    </div>
  );
}
