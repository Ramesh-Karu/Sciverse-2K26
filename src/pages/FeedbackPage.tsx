import React, { useState, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, Send, ShieldCheck, Sparkles, School, User, 
  ArrowLeft, CheckCircle2, MessageSquare, AlertCircle, HelpCircle
} from 'lucide-react';
import { FeedbackReview } from '../types';

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [userType, setUserType] = useState<'viewer' | 'teacher'>('viewer');
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [experience, setExperience] = useState<string>('');
  const [canBeChanged, setCanBeChanged] = useState<string>('');
  const [futureExpectations, setFutureExpectations] = useState<string>('');
  const [impact, setImpact] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState<boolean>(false);

  // Helper to describe the rating out of 10
  const getRatingLabel = (score: number) => {
    if (score === 0) return 'Select a rating from 1 to 10 stars';
    if (score <= 2) return 'Disappointing / Needs significant overhaul ⚠️';
    if (score <= 4) return 'Below Expectations / Minor value 📉';
    if (score <= 6) return 'Satisfactory / Average exhibition experience 👍';
    if (score <= 8) return 'Very Good / Inspirational and highly interactive ⭐';
    if (score === 9) return 'Exceptional / Outstanding scientific presentation 🌟';
    return 'Incredible / Peerless masterpiece! 🌌';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      error('Please select a star rating out of 10 points.');
      return;
    }
    if (!experience.trim()) {
      error('Please write a short description of your experience.');
      return;
    }
    if (!canBeChanged.trim()) {
      error('Please describe what can be changed or improved.');
      return;
    }
    if (!futureExpectations.trim()) {
      error('Please share your expectations for future events.');
      return;
    }
    if (!impact.trim()) {
      error('Please answer how this event impacted you.');
      return;
    }

    setIsSubmitting(true);

    try {
      const reviewData: Omit<FeedbackReview, 'id'> = {
        userType,
        rating,
        experience: experience.trim(),
        canBeChanged: canBeChanged.trim(),
        futureExpectations: futureExpectations.trim(),
        impact: impact.trim(),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'reviews'), reviewData);
      
      success('Thank you! Your anonymous review has been successfully recorded.');
      setSubmittedSuccessfully(true);
    } catch (err: any) {
      console.error('Error submitting anonymous review:', err);
      error(`Submission failed: ${err.message || 'Unknown network error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 selection:bg-blue-500/30">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 pt-4 pb-20">
        {/* Back Link */}
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors uppercase tracking-wider mb-8 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Homepage
        </button>

        <AnimatePresence mode="wait">
          {!submittedSuccessfully ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Header Titles */}
              <div className="space-y-3">
                <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-[10px] font-mono tracking-widest uppercase inline-block">
                  Academic Feedback Suite
                </span>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Anonymous Ratings & Review Page
                </h1>
                <p className="text-sm text-slate-400 max-w-2xl">
                  Your critiques help us evaluate the <span className="text-blue-400">SciVerse 2K26</span> exhibitions and lab campaigns. 
                  This feedback is strictly anonymous—no personal data or email logins are registered.
                </p>
              </div>

              {/* Anonymity Banner */}
              <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl">
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-blue-300 font-mono uppercase tracking-wider">🔒 Guaranteed Identity Security</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    This review pipeline writes feedback as isolated independent items in the Firestore database. No authentication tags, cookies, session credentials, or Google account metrics are cataloged. Please write freely and constructively.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8 bg-white/[0.02] border border-white/5 p-6 md:p-8 rounded-3xl backdrop-blur-2xl">
                
                {/* 1. Identity Selector (Viewer vs. Teacher) */}
                <div className="space-y-3">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-blue-400" />
                    1. Choose your participant role
                  </label>
                  <p className="text-xs text-slate-500">Helps organizers categorize responses based on the visitor profile</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <button
                      type="button"
                      onClick={() => setUserType('viewer')}
                      className={`p-5 rounded-2xl border flex items-center gap-4 transition-all text-left cursor-pointer ${
                        userType === 'viewer'
                          ? 'bg-blue-600/10 border-blue-500 text-white shadow-lg shadow-blue-500/5'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                      }`}
                    >
                      <div className={`p-3 rounded-xl border transition-all ${
                        userType === 'viewer' ? 'bg-blue-600/20 border-blue-400' : 'bg-slate-800 border-white/5'
                      }`}>
                        <User className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">General Viewer / Student</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Exhibition observer, parent, or external student</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserType('teacher')}
                      className={`p-5 rounded-2xl border flex items-center gap-4 transition-all text-left cursor-pointer ${
                        userType === 'teacher'
                          ? 'bg-indigo-600/10 border-indigo-500 text-white shadow-lg shadow-indigo-500/5'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                      }`}
                    >
                      <div className={`p-3 rounded-xl border transition-all ${
                        userType === 'teacher' ? 'bg-indigo-600/20 border-indigo-400' : 'bg-slate-800 border-white/5'
                      }`}>
                        <School className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">Teacher / Educator</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Academic evaluator, mentor, or accompanying staff</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Rating Meter - Out of 10 */}
                <div className="space-y-4 pt-2 border-t border-white/5">
                  <div>
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-amber-400" />
                      2. For 10 points, what would you give it?
                    </label>
                    <p className="text-xs text-slate-500 mt-1">Scale from 1 star (very poor) to 10 stars (masterpiece of scientific modeling)</p>
                  </div>

                  <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 space-y-4">
                    {/* Star Row */}
                    <div className="flex flex-wrap justify-between items-center gap-2 max-w-xl mx-auto">
                      {[...Array(10)].map((_, i) => {
                        const starValue = i + 1;
                        const isStarred = starValue <= (hoveredRating || rating);
                        return (
                          <button
                            key={starValue}
                            type="button"
                            onClick={() => setRating(starValue)}
                            onMouseEnter={() => setHoveredRating(starValue)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="p-1 focus:outline-none cursor-pointer group transition-transform hover:scale-125"
                            title={`${starValue} / 10 Stars`}
                          >
                            <Star 
                              className={`w-7 h-7 sm:w-8 sm:h-8 transition-all duration-150 ${
                                isStarred 
                                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' 
                                  : 'text-slate-600 hover:text-slate-500'
                              }`} 
                            />
                            <span className="block text-[9px] font-mono font-bold text-slate-500 mt-1 text-center">
                              {starValue}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Numeric Value display & qualitative label */}
                    <div className="text-center pt-2 border-t border-white/5">
                      <p className="text-3xl font-black font-mono tracking-tight text-white">
                        {rating > 0 ? `${rating}` : '--'}<span className="text-sm font-normal text-slate-500"> / 10 Points</span>
                      </p>
                      <p className={`text-xs mt-1 font-medium ${rating > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {getRatingLabel(hoveredRating || rating)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Detailed Text Evaluation */}
                <div className="space-y-6 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-400">
                      3. Qualitative Detailed Questions
                    </h3>
                  </div>

                  {/* Q1: What was the experience? */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>• What was the experience? <span className="text-red-400">*</span></span>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </label>
                    <textarea
                      required
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="Share your detailed feedback on structural setups, academic quality of laboratories, experiment variety, and visitor guidance..."
                      rows={4}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-sans"
                    />
                  </div>

                  {/* Q2: What can be changed? */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>• What can be changed? <span className="text-red-400">*</span></span>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </label>
                    <textarea
                      required
                      value={canBeChanged}
                      onChange={(e) => setCanBeChanged(e.target.value)}
                      placeholder="Specify things such as timing slots, queue controls, visual presentation, sound bounds, layout mapping, or accommodation..."
                      rows={4}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-sans"
                    />
                  </div>

                  {/* Q3: What do you expect in the future? */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>• What do you expect in the future? <span className="text-red-400">*</span></span>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </label>
                    <textarea
                      required
                      value={futureExpectations}
                      onChange={(e) => setFutureExpectations(e.target.value)}
                      placeholder="What topics, advanced machinery, virtual physics setups, cosmic astronomical models, or competitions would you love to see next?"
                      rows={4}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-sans"
                    />
                  </div>

                  {/* Q4: What's the impact? */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>• What's the impact? <span className="text-red-400">*</span></span>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </label>
                    <textarea
                      required
                      value={impact}
                      onChange={(e) => setImpact(e.target.value)}
                      placeholder="How has this affected your scientific curiosity, academic passion, or thoughts on research careers?"
                      rows={4}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Submission CTA */}
                <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <p className="text-xs text-slate-500 italic">
                    By submitting, you represent that this feedback strictly adheres to academic integrity.
                  </p>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs font-mono uppercase tracking-widest px-8 py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Recording Review...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Anonymous Review
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 px-6 bg-white/[0.02] border border-white/5 rounded-3xl max-w-xl mx-auto space-y-6 backdrop-blur-2xl"
            >
              <div className="flex justify-center">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-16 h-16" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Review Successfully Saved!</h2>
                <p className="text-sm text-slate-400">
                  Thank you for taking the time to share your ratings. Your anonymous suggestions have been saved securely in our analytics suite to evaluate the Science Union campaigns.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Return Home
                </button>
                <button
                  onClick={() => {
                    setRating(0);
                    setExperience('');
                    setCanBeChanged('');
                    setFutureExpectations('');
                    setImpact('');
                    setSubmittedSuccessfully(false);
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                >
                  Submit Another Review
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
