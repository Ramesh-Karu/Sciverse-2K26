import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Navbar from '../components/Navbar';
import RobotAssistant from '../components/RobotAssistant';
import { SchoolPassCard, CardSchoolData } from '../components/StylishCardGenerator';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, User, Mail, Phone, MapPin, Calendar, Clock, 
  Sparkles, CheckCircle2, ChevronRight, ChevronLeft, Upload, FileText, 
  HelpCircle, Shield, AlertCircle
} from 'lucide-react';

export default function RegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginMode = searchParams.get('login') === 'true';

  // Wizard state
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    principalName: '',
    teacherInCharge: '',
    teacherInChargeEmail: '',
    teacherInChargePhone: '',
    contact: '',
    whatsapp: '',
    email: '',
    address: '',
    logoUrl: 'https://i.ibb.co/hJp9jZb4/1000192206-imgupscaler-ai-General-8-K.jpg',
    expectedStudents: 15,
    expectedTeachers: 2,
    preferredDay: 'Day 2 - Exhibitions & Practical Labs (July 23)',
    arrivalTime: '08:30 AM - 09:00 AM',
    specialRequirements: '',
  });

  // Logins/Bypass status checks
  const [statusEmail, setStatusEmail] = useState('');
  const [statusResult, setStatusResult] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [registeredSchool, setRegisteredSchool] = useState<CardSchoolData | null>(null);

  // Standard drop-downs
  const [eventDays, setEventDays] = useState<any[]>([]);
  const [arrivalSlots, setArrivalSlots] = useState<any[]>([]);

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);

    // Fetch lists for select elements
    const fetchSelects = async () => {
      try {
        const daysSnap = await getDocs(collection(db, 'eventDays'));
        const daysList = daysSnap.docs.map(doc => doc.data());
        const filteredDays = daysList.filter((d: any) => d.isOpenForRegistration !== false);
        setEventDays(filteredDays);

        if (filteredDays.length > 0) {
          setFormData(prev => ({
            ...prev,
            preferredDay: filteredDays[0].name
          }));
        }
        
        const slotsSnap = await getDocs(collection(db, 'arrivalSlots'));
        setArrivalSlots(slotsSnap.docs.map(doc => doc.data()));
      } catch (err) {
        console.error(err);
      }
    };
    fetchSelects();
  }, []);



  const validateStep = () => {
    setErrorMessage('');
    if (step === 1) {
      if (!formData.name.trim() || !formData.email.trim() || !formData.contact.trim() || !formData.whatsapp.trim() || !formData.address.trim()) {
        setErrorMessage('Please fill out all school details, contact number, WhatsApp number, and email.');
        return false;
      }
      if (!formData.email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return false;
      }
    } else if (step === 2) {
      if (formData.expectedStudents <= 0 || formData.expectedTeachers <= 0) {
        setErrorMessage('Students and teachers must be greater than zero.');
        return false;
      }
    } else if (step === 3) {
      if (!formData.principalName.trim() || !formData.teacherInCharge.trim() || !formData.teacherInChargeEmail.trim() || !formData.teacherInChargePhone.trim()) {
        setErrorMessage("Please enter Principal name, Teacher-in-Charge name, email, and phone number.");
        return false;
      }
      if (!formData.teacherInChargeEmail.includes('@')) {
        setErrorMessage("Please enter a valid Teacher-in-Charge email address.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setErrorMessage('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Generate unique SciVerse registration ID immediately
      const randomIdSuffix = Math.floor(1000 + Math.random() * 9000);
      const regId = `SV26-${randomIdSuffix}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${regId}`;

      // Log notification and submit to firestore
      const docRef = await addDoc(collection(db, 'schools'), {
        ...formData,
        expectedStudents: Number(formData.expectedStudents),
        expectedTeachers: Number(formData.expectedTeachers),
        status: 'pending',
        registrationId: regId,
        qrCodeUrl: qrUrl,
        quota: 30, // default pre-approved quota allocation
        createdAt: new Date().toISOString()
      });

      // Automatically dispatch the registration pending HTML email
      try {
        await fetch('/api/email/pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            teacherInCharge: formData.teacherInCharge,
            registrationId: regId,
            expectedStudents: Number(formData.expectedStudents),
            expectedTeachers: Number(formData.expectedTeachers),
          })
        });
      } catch (emailErr) {
        console.error("Failed to automatically dispatch pending email:", emailErr);
      }

      // Submit a simulated notification log
      await addDoc(collection(db, 'notificationLogs'), {
        schoolName: formData.name,
        email: formData.email,
        subject: 'SciVerse 2K26 Registration Received',
        message: `Hello ${formData.teacherInCharge}, your registration request for SciVerse 2K26 has been successfully logged. Your Portal access ID is ${regId}. Access the portal immediately to manage rosters while approval is finalized.`,
        type: 'reminder',
        sentAt: new Date().toISOString()
      });

      setRegisteredSchool({
        id: docRef.id,
        name: formData.name,
        teacherInCharge: formData.teacherInCharge,
        teacherInChargeEmail: formData.teacherInChargeEmail,
        teacherInChargePhone: formData.teacherInChargePhone,
        principalName: formData.principalName,
        email: formData.email,
        contact: formData.contact,
        whatsapp: formData.whatsapp,
        preferredDay: formData.preferredDay,
        arrivalTime: formData.arrivalTime,
        expectedStudents: Number(formData.expectedStudents),
        expectedTeachers: Number(formData.expectedTeachers),
        status: 'pending',
        registrationId: regId,
        qrCodeUrl: qrUrl,
        quota: 30
      });

      setIsSubmitted(true);
    } catch (error) {
      console.error("Submitting error: ", error);
      setErrorMessage("Database connectivity timeout. Please verify configuration or retry.");
    } finally {
      setIsLoading(false);
    }
  };

  // Status check for schools that submitted registration
  const handleCheckStatus = async (e: FormEvent) => {
    e.preventDefault();
    setStatusError('');
    setStatusResult(null);
    setIsCheckingStatus(true);

    if (!statusEmail.trim()) {
      setStatusError('Please enter the email registered with your school.');
      setIsCheckingStatus(false);
      return;
    }

    try {
      const q = query(collection(db, 'schools'), where('email', '==', statusEmail.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setStatusError('No active school registration found matching this email.');
      } else {
        const schoolDoc = snap.docs[0].data();
        setStatusResult({ id: snap.docs[0].id, ...schoolDoc });
      }
    } catch (err) {
      console.error(err);
      setStatusError('Error retrieving status. Please retry.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden relative">
      {/* Background visual elements */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full filter blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-indigo-600/10 rounded-full filter blur-[100px] pointer-events-none z-0"></div>

      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 relative z-10 py-8">
        
        {/* UPPER TITLE */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-mono tracking-wider uppercase">
            <Building className="w-3.5 h-3.5 animate-pulse" /> Invitation Enrollment
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            SciVerse 2K26 School Registration
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Provide school details to register your delegates. Upon review and approval by the Science Union committee, you will receive an exclusive coordinator portal ID.
          </p>
        </div>

        {/* DEMO BYPASS BANNER */}
        <div className="mb-8 p-4 bg-blue-900/20 border border-blue-500/30 rounded-2xl flex items-start gap-3 backdrop-blur-md">
          <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white uppercase font-mono">Sandbox Demo Fast-Pass:</span> Want to test the School Portal immediately without waiting for Admin Approval? Use our pre-approved school ID <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">SV26-0042</span> in the login on the <span className="underline cursor-pointer hover:text-white" onClick={() => navigate('/')}>Home Page</span>!
          </div>
        </div>

        <div className="grid md:grid-cols-12 gap-8 items-start">
          
          {/* MAIN WIZARD CONTAINER */}
          <div className="md:col-span-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-6">
            
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <div className="space-y-6">
                  
                  {/* STEP INDICATORS */}
                  <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5 text-xs font-mono text-slate-400">
                    <span className={step === 1 ? 'text-blue-400 font-bold' : ''}>1. School Info</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className={step === 2 ? 'text-blue-400 font-bold' : ''}>2. Attendance & RSVP</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className={step === 3 ? 'text-blue-400 font-bold' : ''}>3. Contacts & Submit</span>
                  </div>

                  {errorMessage && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
                    </motion.div>
                  )}

                  {/* STEP 1: IDENTITY */}
                  {step === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                        <Building className="w-5 h-5 text-blue-400" /> School Information
                      </h3>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">SCHOOL NAME</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Jaffna Central College"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">OFFICIAL EMAIL</label>
                            <input
                              type="email"
                              required
                              placeholder="e.g. school@secretariat.lk"
                              value={formData.email}
                              onChange={e => setFormData({...formData, email: e.target.value})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">CONTACT NUMBER</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. +94 21 222 1234"
                              value={formData.contact}
                              onChange={e => setFormData({...formData, contact: e.target.value})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">SCHOOL WHATSAPP NUMBER</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. +94 77 123 4567"
                              value={formData.whatsapp}
                              onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">POSTAL ADDRESS</label>
                          <textarea
                            rows={2}
                            required
                            placeholder="Full address of the school"
                            value={formData.address}
                            onChange={e => setFormData({...formData, address: e.target.value})}
                            className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                          />
                        </div>


                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: ESTIMATES & PREFERENCES */}
                  {step === 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                        <Calendar className="w-5 h-5 text-blue-400" /> Attendance RSVP & Preferences
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">EXPECTED STUDENTS COUNT</label>
                            <input
                              type="number"
                              required
                              min={1}
                              max={100}
                              value={formData.expectedStudents}
                              onChange={e => setFormData({...formData, expectedStudents: Number(e.target.value)})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Estimations help allot seating.</p>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">EXPECTED TEACHERS COUNT</label>
                            <input
                              type="number"
                              required
                              min={1}
                              max={15}
                              value={formData.expectedTeachers}
                              onChange={e => setFormData({...formData, expectedTeachers: Number(e.target.value)})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">PREFERRED EVENT DAY</label>
                            <select
                              value={formData.preferredDay}
                              onChange={e => setFormData({...formData, preferredDay: e.target.value})}
                              className="w-full bg-slate-900 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                            >
                              {eventDays.map((d, dIdx) => (
                                <option key={dIdx} value={d.name}>{d.name}</option>
                              ))}
                            </select>
                            {eventDays.find(d => d.name === formData.preferredDay)?.description && (
                              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                                {eventDays.find(d => d.name === formData.preferredDay).description}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">PREFERRED ARRIVAL TIME SLOT</label>
                            <select
                              value={formData.arrivalTime}
                              onChange={e => setFormData({...formData, arrivalTime: e.target.value})}
                              className="w-full bg-slate-900 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-3 py-2.5 text-sm text-white"
                            >
                              {arrivalSlots.map((s, sIdx) => (
                                <option key={sIdx} value={s.time}>{s.time}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: CONTACTS & REQUISITIONS */}
                  {step === 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                        <User className="w-5 h-5 text-blue-400" /> Contacts & Requirements
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">PRINCIPAL'S FULL NAME</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Rev. Fr. A. P. Joseph"
                              value={formData.principalName}
                              onChange={e => setFormData({...formData, principalName: e.target.value})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">TEACHER-IN-CHARGE NAME</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Mrs. M. Pushparani"
                              value={formData.teacherInCharge}
                              onChange={e => setFormData({...formData, teacherInCharge: e.target.value})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">TEACHER-IN-CHARGE EMAIL</label>
                            <input
                              type="email"
                              required
                              placeholder="e.g. teacher@school.lk"
                              value={formData.teacherInChargeEmail}
                              onChange={e => setFormData({...formData, teacherInChargeEmail: e.target.value})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">TEACHER-IN-CHARGE PHONE</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. +94 77 123 4567"
                              value={formData.teacherInChargePhone}
                              onChange={e => setFormData({...formData, teacherInChargePhone: e.target.value})}
                              className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">SPECIAL REQUIREMENTS OR DISABILITY ACCESS</label>
                          <textarea
                            rows={3}
                            placeholder="Enter dietary needs, transport concerns, wheelchair ramps, or session scheduling requirements..."
                            value={formData.specialRequirements}
                            onChange={e => setFormData({...formData, specialRequirements: e.target.value})}
                            className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* NAVIGATION CONTROL */}
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    {step > 1 ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={handlePrev}
                        className="px-5 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-bold font-mono uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </motion.button>
                    ) : (
                      <div></div>
                    )}

                    {step < 3 ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={handleNext}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-mono uppercase flex items-center gap-1.5 ml-auto cursor-pointer"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={isLoading}
                        onClick={handleSubmit}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold font-mono uppercase tracking-wider shadow-[0_4px_20px_rgba(59,130,246,0.3)] flex items-center gap-1.5 ml-auto cursor-pointer"
                      >
                        {isLoading ? 'Transmitting Data...' : 'Submit Delegation'}
                      </motion.button>
                    )}
                  </div>

                </div>
              ) : (
                /* SUCCESSFUL SUBMISSION PANEL */
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10 space-y-6"
                >
                  <div className="w-16 h-16 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">
                    ✓
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-extrabold text-white">Delegation Logged!</h3>
                    <p className="text-sm text-slate-300 max-w-md mx-auto">
                      Your registration request has been successfully transmitted to the SciVerse 2K26 Executive Committee.
                    </p>
                  </div>

                  {registeredSchool && (
                    <div className="max-w-md mx-auto pt-2">
                      <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider font-mono">Your SciVerse Delegation Ticket Pass:</p>
                      <SchoolPassCard school={registeredSchool} className="text-left" />
                    </div>
                  )}
                  
                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl max-w-md mx-auto text-xs text-left text-slate-400 space-y-2 leading-relaxed">
                    <p className="font-bold text-white font-mono flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> NEXT STEPS:
                    </p>
                    <p>1. The organizing committee will review and verify your school delegation.</p>
                    <p>2. Upon approval, an email will be sent with your <span className="text-blue-400 font-bold">School Registration ID</span> and passcodes.</p>
                    <p>3. Use that ID on the <span className="underline cursor-pointer text-white" onClick={() => navigate('/')}>Home Page</span> to enter your coordinator portal and add your delegate rosters.</p>
                  </div>

                  <div className="flex justify-center gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate('/')}
                      className="px-6 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-bold font-mono uppercase cursor-pointer"
                    >
                      Return Home
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setStatusEmail(formData.email);
                        setStep(1);
                        setIsSubmitted(false);
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold font-mono uppercase cursor-pointer"
                    >
                      Check Live Status
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* SIDEBAR: CHECK REGISTRATION STATUS */}
          <div className="md:col-span-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-blue-400" />
                Track School Status
              </h3>
              <p className="text-[11px] text-slate-400">Instantly look up status and obtain registration ID</p>
            </div>

            <form onSubmit={handleCheckStatus} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  placeholder="Enter registered school email"
                  value={statusEmail}
                  onChange={e => setStatusEmail(e.target.value)}
                  className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              
              {statusError && (
                <p className="text-[11px] text-red-400">{statusError}</p>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isCheckingStatus}
                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider cursor-pointer"
              >
                {isCheckingStatus ? 'Searching records...' : 'Fetch Status'}
              </motion.button>
            </form>

            <AnimatePresence>
              {statusResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-slate-900/80 border border-white/5 rounded-2xl space-y-3.5 text-xs text-slate-300"
                >
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="font-bold text-white max-w-[150px] truncate">{statusResult.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      statusResult.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                      statusResult.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400 animate-pulse'
                    }`}>
                      {statusResult.status}
                    </span>
                  </div>

                  <div className="pt-1">
                    <SchoolPassCard school={statusResult} className="text-left" />
                  </div>

                  {statusResult.status === 'approved' ? (
                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-400">Use this approved QR Pass or Registration ID SV26-xxxx to enter your school coordinator portal dashboard:</p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          localStorage.setItem('schoolSessionId', statusResult.id);
                          localStorage.setItem('schoolRegId', statusResult.registrationId);
                          navigate('/dashboard');
                        }}
                        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold uppercase text-[10px] font-mono tracking-wider transition cursor-pointer shadow-lg"
                      >
                        Enter Portal Dashboard
                      </motion.button>
                    </div>
                  ) : statusResult.status === 'rejected' ? (
                    <p className="text-red-400 text-[11px]">This request has been declined. Please contact scienceunionjhc@gmail.com to appeal delegation adjustments.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-yellow-400 text-[11px]">Your request is pending review. The SciVerse organizers typically approve registrations within 2-4 hours.</p>
                      <div className="h-1 w-full bg-white/15 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 w-1/2 animate-infinite-loading"></div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>

      </main>

      <RobotAssistant />
    </div>
  );
}
