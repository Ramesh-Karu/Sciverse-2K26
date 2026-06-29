import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import Navbar from '../components/Navbar';
import RobotAssistant from '../components/RobotAssistant';
import { SchoolPassCard, CardSchoolData } from '../components/StylishCardGenerator';
import { SoloStudent } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, User, Mail, Phone, MapPin, Calendar, Clock, 
  Sparkles, CheckCircle2, ChevronRight, ChevronLeft, Upload, FileText, 
  HelpCircle, Shield, AlertCircle, Users, MessageCircle
} from 'lucide-react';

export default function RegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginMode = searchParams.get('login') === 'true';

  // Selection state
  const [registrationType, setRegistrationType] = useState<'school' | 'student' | null>(null);

  // Wizard state
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('registrationFormData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
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
    };
  });

  const [studentData, setStudentData] = useState(() => {
    const saved = localStorage.getItem('studentRegistrationData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      name: '',
      school: '',
      age: 15,
      grade: '',
      contact: '',
      whatsapp: '',
      email: '',
      address: '',
      parentName: '',
      parentContact: '',
      parentEmail: '',
      preferredDay: 'Day 2 - Exhibitions & Practical Labs (July 23)',
      arrivalTime: '08:30 AM - 09:00 AM',
    };
  });

  useEffect(() => {
    localStorage.setItem('registrationFormData', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem('studentRegistrationData', JSON.stringify(studentData));
  }, [studentData]);

  // Logins/Bypass status checks
  const [statusEmail, setStatusEmail] = useState('');
  const [statusResult, setStatusResult] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [registeredSchool, setRegisteredSchool] = useState<CardSchoolData | null>(null);
  const [registeredStudent, setRegisteredStudent] = useState<SoloStudent | null>(null);

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
          setStudentData(prev => ({
            ...prev,
            preferredDay: filteredDays[0].name
          }));
        }
        
        const slotsSnap = await getDocs(collection(db, 'arrivalSlots'));
        const slotsList = slotsSnap.docs.map(doc => doc.data());
        setArrivalSlots(slotsList);

        if (slotsList.length > 0) {
          setFormData(prev => ({
            ...prev,
            arrivalTime: slotsList[0].time
          }));
          setStudentData(prev => ({
            ...prev,
            arrivalTime: slotsList[0].time
          }));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSelects();
  }, []);



  const validateStep = () => {
    setErrorMessage('');
    
    if (registrationType === 'school') {
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
    } else if (registrationType === 'student') {
      if (step === 1) {
        if (!studentData.name.trim() || !studentData.school.trim() || !studentData.email.trim() || !studentData.contact.trim() || !studentData.whatsapp.trim() || !studentData.address.trim()) {
          setErrorMessage('Please fill out your personal information, school name, WhatsApp number, and email.');
          return false;
        }
        if (!studentData.email.includes('@')) {
          setErrorMessage('Please enter a valid email address.');
          return false;
        }
      } else if (step === 2) {
        // Attendance RSVP validation (selects have defaults, so mostly valid)
      } else if (step === 3) {
        if (!studentData.parentName.trim() || !studentData.parentContact.trim()) {
          setErrorMessage('Parent/Guardian details are required for solo student participation.');
          return false;
        }
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
      const randomIdSuffix = Math.floor(1000 + Math.random() * 9000);

      if (registrationType === 'school') {
        const regId = `SV26-${randomIdSuffix}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${regId}`;
        let docRef;
        try {
          docRef = await addDoc(collection(db, 'schools'), {
            ...formData,
            expectedStudents: Number(formData.expectedStudents),
            expectedTeachers: Number(formData.expectedTeachers),
            status: 'pending',
            registrationId: regId,
            qrCodeUrl: qrUrl,
            quota: 30,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'schools');
          return;
        }

        // Email and Logs...
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
        } catch (emailErr) {}

        try {
          await addDoc(collection(db, 'notificationLogs'), {
            schoolName: formData.name,
            email: formData.email,
            subject: 'SciVerse 2K26 Registration Received',
            message: `Hello ${formData.teacherInCharge}, your registration request has been successfully logged. Your Portal access ID is ${regId}.`,
            type: 'reminder',
            sentAt: new Date().toISOString()
          });
        } catch (logErr) {
          handleFirestoreError(logErr, OperationType.CREATE, 'notificationLogs');
        }

        setRegisteredSchool({
          id: docRef.id,
          name: formData.name,
          registrationId: regId,
          status: 'pending',
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
          qrCodeUrl: qrUrl,
          quota: 30
        });

        localStorage.removeItem('registrationFormData');
      } else {
        // Solo Student Registration
        const regId = `SV26-S-${randomIdSuffix}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${regId}`;
        let docRef;
        try {
          docRef = await addDoc(collection(db, 'soloStudents'), {
            ...studentData,
            status: 'pending',
            registrationId: regId,
            qrCodeUrl: qrUrl,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'soloStudents');
          return;
        }

        try {
          await addDoc(collection(db, 'notificationLogs'), {
            schoolName: studentData.name,
            email: studentData.email,
            subject: 'SciVerse 2K26 Solo Registration Received',
            message: `Hello ${studentData.name}, your solo registration request has been successfully logged. Your Portal access ID is ${regId}.`,
            type: 'reminder',
            sentAt: new Date().toISOString()
          });
        } catch (logErr) {
          console.error("Log error: ", logErr);
        }

        setRegisteredStudent({
          id: docRef.id,
          ...studentData,
          status: 'pending',
          registrationId: regId,
          qrCodeUrl: qrUrl,
          createdAt: new Date().toISOString()
        });
      }
      localStorage.removeItem('studentRegistrationData');

      setIsSubmitted(true);
    } catch (error) {
      console.error("Submitting error: ", error);
      if (error instanceof Error) {
        try {
          const detailed = JSON.parse(error.message);
          setErrorMessage(`Permission Error: ${detailed.error}. Path: ${detailed.path}`);
        } catch (e) {
          setErrorMessage(error.message || "Failed to submit registration. Please retry.");
        }
      } else {
        setErrorMessage("Database connectivity timeout. Please verify configuration or retry.");
      }
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
      const qSchools = query(collection(db, 'schools'), where('email', '==', statusEmail.trim()));
      const qSolo = query(collection(db, 'soloStudents'), where('email', '==', statusEmail.trim()));
      
      const [snapSchools, snapSolo] = await Promise.all([getDocs(qSchools), getDocs(qSolo)]);

      if (!snapSchools.empty) {
        const schoolDoc = snapSchools.docs[0].data();
        setStatusResult({ id: snapSchools.docs[0].id, ...schoolDoc });
      } else if (!snapSolo.empty) {
        const soloDoc = snapSolo.docs[0].data();
        setStatusResult({ id: snapSolo.docs[0].id, ...soloDoc });
      } else {
        setStatusError('No active registration found matching this email.');
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

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 relative z-10 py-12">
        
        {/* UPPER TITLE */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-mono tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" /> SciVerse 2K26 Invitation
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {registrationType === 'school' ? 'School Delegation Enrollment' : 
             registrationType === 'student' ? 'Solo Student Registration' : 
             'SciVerse 2K26 Registration'}
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            {registrationType === 'school' ? 'Register your school delegation to participate in SciVerse 2K26.' :
             registrationType === 'student' ? 'Register as an individual student for solo participation and workshops.' :
             'Select your registration type below to begin your journey into SciVerse.'}
          </p>
        </div>


        <div className="grid md:grid-cols-12 gap-8 items-start">
          
          {/* MAIN WIZARD CONTAINER */}
          <div className="md:col-span-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-6">
            
            <AnimatePresence mode="wait">
              {!registrationType && !isSubmitted ? (
                <motion.div
                  key="selection"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-4"
                >
                  <button
                    onClick={() => setRegistrationType('school')}
                    className="p-8 bg-white/5 border border-white/10 rounded-2xl text-center space-y-4 hover:bg-blue-600/10 hover:border-blue-500/30 transition group"
                  >
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-400 group-hover:scale-110 transition">
                      <Building className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">School Registration</h3>
                      <p className="text-xs text-slate-400 mt-2">For official delegations led by teachers and principals.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setRegistrationType('student')}
                    className="p-8 bg-white/5 border border-white/10 rounded-2xl text-center space-y-4 hover:bg-indigo-600/10 hover:border-indigo-500/30 transition group"
                  >
                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-indigo-400 group-hover:scale-110 transition">
                      <User className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Students Registration</h3>
                      <p className="text-xs text-slate-400 mt-2">For individual students wishing to participate solo.</p>
                    </div>
                  </button>
                </motion.div>
              ) : !isSubmitted ? (
                <motion.div key="form" className="space-y-6">
                  
                  {/* STEP INDICATORS */}
                  <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5 text-xs font-mono text-slate-400">
                    {registrationType === 'school' ? (
                      <>
                        <span className={step === 1 ? 'text-blue-400 font-bold' : ''}>1. School Info</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        <span className={step === 2 ? 'text-blue-400 font-bold' : ''}>2. Attendance</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        <span className={step === 3 ? 'text-blue-400 font-bold' : ''}>3. Contacts</span>
                      </>
                    ) : (
                      <>
                        <span className={step === 1 ? 'text-indigo-400 font-bold' : ''}>1. Personal Info</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        <span className={step === 2 ? 'text-indigo-400 font-bold' : ''}>2. Attendance</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        <span className={step === 3 ? 'text-indigo-400 font-bold' : ''}>3. Guardian & Conduct</span>
                      </>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => {
                        setRegistrationType(null);
                        setStep(1);
                      }}
                      className="text-[10px] text-slate-500 hover:text-white transition flex items-center gap-1 font-mono uppercase"
                    >
                      <ChevronLeft className="w-3 h-3" /> Change Registration Type
                    </button>
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

                  {/* SCHOOL STEPS */}
                  {registrationType === 'school' && (
                    <>
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
                                placeholder="e.g. Jaffna Hindu College"
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
                                <label className="block text-xs text-slate-400 mb-1">SCHOOL WHATSAPP</label>
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
                            <Calendar className="w-5 h-5 text-blue-400" /> Attendance RSVP
                          </h3>
                          
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">EXPECTED STUDENTS</label>
                                <input
                                  type="number"
                                  required
                                  min={1}
                                  max={100}
                                  value={formData.expectedStudents}
                                  onChange={e => setFormData({...formData, expectedStudents: Number(e.target.value)})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">EXPECTED TEACHERS</label>
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
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">ARRIVAL TIME SLOT</label>
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
                                <label className="block text-xs text-slate-400 mb-1">PRINCIPAL'S NAME</label>
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
                                <label className="block text-xs text-slate-400 mb-1">TEACHER-IN-CHARGE</label>
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
                                <label className="block text-xs text-slate-400 mb-1">TEACHER EMAIL</label>
                                <input
                                  type="email"
                                  required
                                  placeholder="teacher@school.lk"
                                  value={formData.teacherInChargeEmail}
                                  onChange={e => setFormData({...formData, teacherInChargeEmail: e.target.value})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">TEACHER PHONE</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="+94 77 123 4567"
                                  value={formData.teacherInChargePhone}
                                  onChange={e => setFormData({...formData, teacherInChargePhone: e.target.value})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-400 mb-1">SPECIAL REQUIREMENTS</label>
                              <textarea
                                rows={2}
                                placeholder="Dietary needs, disability access, etc."
                                value={formData.specialRequirements}
                                onChange={e => setFormData({...formData, specialRequirements: e.target.value})}
                                className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}

                  {/* SOLO STUDENT STEPS */}
                  {registrationType === 'student' && (
                    <>
                      {/* STEP 1: PERSONAL IDENTITY */}
                      {step === 1 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-4"
                        >
                          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-4">
                            <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-2 mb-1">
                              <Shield className="w-3.5 h-3.5" /> SOLO PARTICIPATION POLICY
                            </h4>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                              Students wishing to participate solo must adhere to the school code of conduct, wear their official school uniform, and MUST be accompanied by a parent or legal guardian for the duration of the event.
                            </p>
                          </div>

                          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                            <User className="w-5 h-5 text-indigo-400" /> Personal Information
                          </h3>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">FULL NAME</label>
                              <input
                                type="text"
                                required
                                placeholder="Your full name"
                                value={studentData.name}
                                onChange={e => setStudentData({...studentData, name: e.target.value})}
                                className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">CURRENT SCHOOL</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="School you are attending"
                                  value={studentData.school}
                                  onChange={e => setStudentData({...studentData, school: e.target.value})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">AGE</label>
                                  <input
                                    type="number"
                                    required
                                    min={10}
                                    max={20}
                                    value={studentData.age}
                                    onChange={e => setStudentData({...studentData, age: Number(e.target.value)})}
                                    className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">GRADE</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. 11"
                                    value={studentData.grade}
                                    onChange={e => setStudentData({...studentData, grade: e.target.value})}
                                    className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">PERSONAL EMAIL</label>
                                <input
                                  type="email"
                                  required
                                  placeholder="yourname@gmail.com"
                                  value={studentData.email}
                                  onChange={e => setStudentData({...studentData, email: e.target.value})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">PERSONAL CONTACT</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="+94 77 xxxxxxx"
                                  value={studentData.contact}
                                  onChange={e => setStudentData({...studentData, contact: e.target.value})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">WHATSAPP NUMBER</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="+94 77 xxxxxxx"
                                  value={studentData.whatsapp}
                                  onChange={e => setStudentData({...studentData, whatsapp: e.target.value})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-400 mb-1">RESIDENTIAL ADDRESS</label>
                              <textarea
                                rows={2}
                                required
                                placeholder="Your full home address for verification"
                                value={studentData.address}
                                onChange={e => setStudentData({...studentData, address: e.target.value})}
                                className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}

                       {/* STEP 2: ATTENDANCE RSVP (FOR SOLO) */}
                      {step === 2 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                            <Clock className="w-5 h-5 text-indigo-400" /> Attendance RSVP
                          </h3>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs text-slate-400 mb-2 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> PREFERRED EVENT DAY
                              </label>
                              <div className="grid grid-cols-1 gap-2">
                                {eventDays.map((day) => (
                                  <label
                                    key={day.id}
                                    className={`relative flex items-center p-4 cursor-pointer rounded-xl border transition-all ${
                                      studentData.preferredDay === day.name
                                        ? 'bg-indigo-500/10 border-indigo-500 ring-1 ring-indigo-500'
                                        : 'bg-slate-900/40 border-white/5 hover:border-white/20'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      className="sr-only"
                                      name="preferredDay"
                                      value={day.name}
                                      checked={studentData.preferredDay === day.name}
                                      onChange={(e) => setStudentData({ ...studentData, preferredDay: e.target.value })}
                                    />
                                    <div className="flex-1">
                                      <p className="text-sm font-bold text-white">{day.name}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">{day.description || 'Access to all main stage events and exhibits.'}</p>
                                    </div>
                                    {studentData.preferredDay === day.name && (
                                      <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white rounded-full"></div>
                                      </div>
                                    )}
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-400 mb-2">EXPECTED ARRIVAL TIME</label>
                              <select
                                value={studentData.arrivalTime}
                                onChange={(e) => setStudentData({ ...studentData, arrivalTime: e.target.value })}
                                className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm font-mono"
                              >
                                {arrivalSlots.map((slot) => (
                                  <option key={slot.id || slot.time} value={slot.time}>
                                    {slot.time}
                                  </option>
                                ))}
                              </select>
                              <p className="text-[10px] text-slate-500 mt-2 italic px-1">
                                * Early arrival is recommended for seamless security check and badge collection.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 3: GUARDIAN & VERIFICATION */}
                      {step === 3 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-4"
                        >
                          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                            <Users className="w-5 h-5 text-indigo-400" /> Parent / Guardian Information
                          </h3>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">PARENT/GUARDIAN FULL NAME</label>
                              <input
                                type="text"
                                required
                                placeholder="Name of parent attending with you"
                                value={studentData.parentName}
                                onChange={e => setStudentData({...studentData, parentName: e.target.value})}
                                className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">GUARDIAN CONTACT NUMBER</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Emergency contact"
                                  value={studentData.parentContact}
                                  onChange={e => setStudentData({...studentData, parentContact: e.target.value})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">GUARDIAN EMAIL (OPTIONAL)</label>
                                <input
                                  type="email"
                                  placeholder="parent@example.com"
                                  value={studentData.parentEmail}
                                  onChange={e => setStudentData({...studentData, parentEmail: e.target.value})}
                                  className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm"
                                />
                              </div>
                            </div>

                            <div className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl">
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" required className="mt-1 w-4 h-4 rounded border-white/20 bg-slate-800 text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-[10px] text-slate-400 leading-relaxed">
                                  I hereby confirm that I will be attending SciVerse 2K26 in my official school uniform, strictly adhering to the code of conduct, and I will be accompanied by the parent/guardian mentioned above at all times during the event.
                                </span>
                              </label>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </>
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

                    {(registrationType === 'school' && step < 3) || (registrationType === 'student' && step < 3) ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={handleNext}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold font-mono uppercase flex items-center gap-1.5 ml-auto cursor-pointer ${
                          registrationType === 'school' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-indigo-600 hover:bg-indigo-500'
                        } text-white`}
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
                        className={`px-8 py-3 bg-gradient-to-r ${
                          registrationType === 'school' ? 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30' : 'from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/30'
                        } disabled:opacity-50 text-white rounded-xl text-xs font-extrabold font-mono uppercase tracking-wider shadow-lg flex items-center gap-1.5 ml-auto cursor-pointer`}
                      >
                        {isLoading ? 'Transmitting Data...' : 'Submit Registration'}
                      </motion.button>
                    )}
                  </div>

                </motion.div>
              ) : (
                /* SUCCESSFUL SUBMISSION PANEL */
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10 space-y-6"
                >
                  <div className={`w-16 h-16 ${registrationType === 'school' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'} border rounded-full flex items-center justify-center mx-auto text-3xl`}>
                    ✓
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-white">Registration Received!</h2>
                    <p className="text-sm text-slate-300 max-w-md mx-auto">
                      Your {registrationType === 'school' ? 'delegation' : 'solo student'} registration request has been successfully transmitted for verification.
                    </p>
                  </div>

                  {registeredSchool && (
                    <div className="max-w-md mx-auto pt-2">
                      <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider font-mono">Official Delegation Pass:</p>
                      <SchoolPassCard school={registeredSchool} className="text-left" />
                    </div>
                  )}

                  {registeredStudent && (
                    <div className="max-w-md mx-auto pt-2">
                      <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider font-mono">Your Personal Solo Pass:</p>
                      <SchoolPassCard 
                        school={{
                          ...registeredStudent,
                          isSolo: true,
                          contact: registeredStudent.contact,
                          preferredDay: registeredStudent.preferredDay || '',
                          arrivalTime: registeredStudent.arrivalTime || '',
                          status: registeredStudent.status
                        } as any} 
                        className="text-left" 
                      />
                    </div>
                  )}
                  
                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl max-w-md mx-auto text-xs text-left text-slate-400 space-y-2 leading-relaxed">
                    <p className="font-bold text-white font-mono flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> NEXT STEPS:
                    </p>
                    <p>1. The SciVerse committee will verify your identity and school credentials.</p>
                    <p>2. Upon approval, you will receive a confirmation email with your official pass.</p>
                    <p>3. <span className="text-white font-bold">Important:</span> Bring your school ID and be in uniform for gate check-in.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                    <motion.a
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      href="https://chat.whatsapp.com/LLz5gMnnPS79RgyCizDR0l"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold font-mono uppercase cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(34,197,94,0.3)]"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" /> Join WhatsApp Updates Group
                    </motion.a>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate('/')}
                      className="px-6 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-bold font-mono uppercase cursor-pointer"
                    >
                      Return Home
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* SIDEBAR: TRACK STATUS */}
          <div className="md:col-span-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4.5 h-4.5 text-blue-400" />
                Track Registration
              </h3>
              <p className="text-[11px] text-slate-400">Instantly look up status for school or solo students</p>
            </div>

            <form onSubmit={handleCheckStatus} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  placeholder="Enter registered email"
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

                  {statusResult.principalName ? (
                    /* School Pass */
                    <>
                      <div className="pt-1">
                        <SchoolPassCard school={statusResult as CardSchoolData} className="text-left" />
                      </div>
                      {statusResult.status === 'approved' && (
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
                      )}
                    </>
                  ) : (
                    /* Solo Pass */
                    <div className="pt-1">
                      <SchoolPassCard 
                        school={{
                          ...statusResult,
                          isSolo: true,
                          preferredDay: statusResult.preferredDay || '',
                          arrivalTime: statusResult.arrivalTime || '',
                          status: statusResult.status
                        } as any} 
                        className="text-left" 
                      />
                    </div>
                  )}

                  {statusResult.status === 'rejected' && (
                    <p className="text-red-400 text-[11px]">This request has been declined. Please contact scienceunionjhc@gmail.com for details.</p>
                  )}
                  {statusResult.status === 'pending' && (
                    <p className="text-yellow-400 text-[11px]">Your request is pending review. Verification typically takes 2-4 hours.</p>
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
