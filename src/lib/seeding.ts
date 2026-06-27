import { db } from './firebase';
import { collection, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';

export async function seedInitialData() {
  try {
    // 1. Seed Event Days
    const daysColl = collection(db, 'eventDays');
    const daysSnap = await getDocs(daysColl);
    const hasOldData = daysSnap.docs.some(doc => doc.data().date === '2026-10-15' || !doc.data().description);
    if (daysSnap.empty || hasOldData) {
      const defaultDays = [
        { 
          id: 'day-1', 
          name: 'Day 1 - Inauguration & Launch (July 22)', 
          date: '2026-07-22', 
          capacity: 1500, 
          reservedSeats: 1500, 
          reservedDetails: { vips: 1500, judges: 0, organizers: 0, teachers: 0, media: 0, guests: 0 }, 
          isOpenForRegistration: false,
          description: "Inaugural opening, guest keynote lectures by premier scientists, and the official launch of the SciVerse 26 Practical Campaign."
        },
        { 
          id: 'day-2', 
          name: 'Day 2 - Exhibitions & Practical Labs (July 23)', 
          date: '2026-07-23', 
          capacity: 1500, 
          reservedSeats: 120, 
          reservedDetails: { vips: 30, judges: 20, organizers: 30, teachers: 20, media: 10, guests: 10 }, 
          isOpenForRegistration: true,
          description: "Active Science Exhibitions & Practical Labs at the A/L Premises. Encouraging students to Experiment, Explore, and Excel through hand-on science campaigns."
        },
        { 
          id: 'day-3', 
          name: 'Day 3 - Competitions & Grand Finale (July 24)', 
          date: '2026-07-24', 
          capacity: 1500, 
          reservedSeats: 150, 
          reservedDetails: { vips: 50, judges: 25, organizers: 35, teachers: 20, media: 10, guests: 10 }, 
          isOpenForRegistration: true,
          description: "Science Union final project competitions, innovative project evaluations, and the Grand Awards Ceremony to reward outstanding student creations."
        }
      ];

      for (const d of defaultDays) {
        const existingDoc = daysSnap.docs.find(doc => doc.id === d.id);
        if (existingDoc) {
          const data = existingDoc.data();
          await setDoc(doc(db, 'eventDays', d.id), {
            ...d,
            reservedSeats: data.reservedSeats !== undefined ? data.reservedSeats : d.reservedSeats,
            reservedDetails: data.reservedDetails !== undefined ? data.reservedDetails : d.reservedDetails
          });
        } else {
          await setDoc(doc(db, 'eventDays', d.id), d);
        }
      }
    }

    // 2. Seed Arrival Slots
    const slotsColl = collection(db, 'arrivalSlots');
    const slotsSnap = await getDocs(slotsColl);
    if (slotsSnap.empty) {
      const defaultSlots = [
        { id: 'slot-1', time: '08:00 AM - 08:30 AM', capacity: 150, currentCount: 15 },
        { id: 'slot-2', time: '08:30 AM - 09:00 AM', capacity: 200, currentCount: 20 },
        { id: 'slot-3', time: '09:00 AM - 09:30 AM', capacity: 200, currentCount: 10 },
        { id: 'slot-4', time: '09:30 AM - 10:00 AM', capacity: 150, currentCount: 0 },
        { id: 'slot-5', time: '10:00 AM - 10:30 AM', capacity: 100, currentCount: 0 }
      ];

      for (const s of defaultSlots) {
        await setDoc(doc(db, 'arrivalSlots', s.id), s);
      }
    }

    // 3. Seed Announcements
    const annColl = collection(db, 'announcements');
    const annSnap = await getDocs(annColl);
    const hasOldAnn = annSnap.docs.some(doc => doc.data().content?.includes('October'));
    if (annSnap.empty || hasOldAnn) {
      const defaultAnnouncements = [
        {
          id: 'ann-1',
          title: 'Welcome to SciVerse 2K26 Registration Portal!',
          content: 'The Jaffna Hindu College Science Union is thrilled to welcome schools across the province. Please register your school details, and upon approval, add your student and teacher lists before the RSVP deadline of July 15th, 2026.',
          category: 'info',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ann-2',
          title: 'Maximum Participant Quotas Assigned',
          content: 'To accommodate as many schools as possible, each school has been allocated a participant limit (typically 20-30 slots). Check your portal dashboard to monitor your quota.',
          category: 'schedule',
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'ann-3',
          title: 'QR Event Passes Required at Ingress Gates',
          content: 'Please ensure every participant downloads their customized SciVerse QR event pass. Digital or printed passes will be scanned at the security check-in gates for attendance tracking.',
          category: 'alert',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ];

      for (const a of defaultAnnouncements) {
        await setDoc(doc(db, 'announcements', a.id), a);
      }
    }

    // 4. Seed Pre-approved schools for demonstration/testing
    // const schoolsColl = collection(db, 'schools');
    // const schoolsSnap = await getDocs(schoolsColl);
    // if (schoolsSnap.empty) {
    //   const defaultSchoolId = 'demo-school-1';
    //   const defaultSchool = {
    //     name: "St. Patrick's College",
    //     principalName: "Rev. Fr. A. P. Joseph",
    //     teacherInCharge: "Mr. S. Daniel",
    //     contact: "+94 77 123 4567",
    //     email: "stpatricks@jhc.lk",
    //     address: "St. Patrick's Road, Jaffna",
    //     logoUrl: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200",
    //     status: "approved",
    //     registrationId: "SV26-0042",
    //     qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=SV26-0042",
    //     expectedStudents: 25,
    //     expectedTeachers: 5,
    //     preferredDay: "Day 2 - Exhibitions & Practical Labs (July 23)",
    //     arrivalTime: "08:30 AM - 09:00 AM",
    //     specialRequirements: "Wheelchair ramp access for 2 students",
    //     quota: 30,
    //     createdAt: new Date(Date.now() - 172800000).toISOString()
    //   };
    //
    //   await setDoc(doc(db, 'schools', defaultSchoolId), defaultSchool);
    //
    //   // Seed mock participants for this school
    //   const participants = [
    //     { id: 'part-1', name: 'Niranjan Sivakumar', type: 'student', role: 'Grade 11 - Physical Science', contact: '+94 77 888 1111', competitions: ['Rocketry Challenge', 'Physics Quiz'], checkedIn: false },
    //     { id: 'part-2', name: 'Jeyam Thanabalasingam', type: 'student', role: 'Grade 12 - Biology', contact: '+94 77 888 2222', competitions: ['Biology Olympiad'], checkedIn: false },
    //     { id: 'part-3', name: 'Mr. S. Daniel', type: 'teacher', role: 'Senior Physics Instructor', contact: '+94 77 888 3333', competitions: [], checkedIn: false }
    //   ];
    //
    //   for (const p of participants) {
    //     await setDoc(doc(db, `schools/${defaultSchoolId}/participants`, p.id), {
    //       schoolId: defaultSchoolId,
    //       ...p
    //     });
    //   }
    //
    //   // Add another pending school to test approval flow
    //   await setDoc(doc(db, 'schools', 'demo-school-2'), {
    //     name: "Vembadi Girls' High School",
    //     principalName: "Mrs. K. Anandaraja",
    //     teacherInCharge: "Mrs. M. Pushparani",
    //     contact: "+94 77 987 6543",
    //     email: "vembadi@jhc.lk",
    //     address: "Vembadi Road, Jaffna",
    //     logoUrl: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=200",
    //     status: "pending",
    //     expectedStudents: 15,
    //     expectedTeachers: 3,
    //     preferredDay: "Day 3 - Competitions & Grand Finale (July 24)",
    //     arrivalTime: "09:00 AM - 09:30 AM",
    //     specialRequirements: "Reserved seating for teachers near front podium",
    //     quota: 20,
    //     createdAt: new Date(Date.now() - 86400000).toISOString()
    //   });
    //   
    //   console.log('Seeded pre-approved school St. Patrick\'s College (SV26-0042)');
    // }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}
