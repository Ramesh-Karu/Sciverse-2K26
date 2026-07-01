import React, { useState } from 'react';
import QRCode from 'qrcode';
import { Download, Sparkles, CheckCircle, Clock, Copy, Check, MessageCircle } from 'lucide-react';

export interface CardSchoolData {
  id: string;
  name: string;
  registrationId?: string;
  teacherInCharge?: string;
  teacherInChargeEmail?: string;
  teacherInChargePhone?: string;
  principalName?: string;
  email: string;
  contact: string;
  preferredDay: string;
  arrivalTime: string;
  expectedStudents?: number;
  expectedTeachers?: number;
  status: 'pending' | 'approved' | 'rejected';
  isSolo?: boolean;
  school?: string;
  parentName?: string;
}

// Function to wrap and draw text on canvas
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
}

// Draw the elegant card to a canvas and export as DataURL PNG
export async function generatePassCardDataURL(school: CardSchoolData): Promise<string> {
  const canvas = document.createElement('canvas');
  const scale = 3; // 3x scaling for ultra high resolution HD print quality
  canvas.width = 480 * scale;
  canvas.height = 760 * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Scale all subsequent drawing operations to render beautifully and crisp
  ctx.scale(scale, scale);

  // 1. Beautiful Space Gradient Background
  const grad = ctx.createLinearGradient(0, 0, 480, 760);
  grad.addColorStop(0, '#090d16');
  grad.addColorStop(0.5, '#0b1329');
  grad.addColorStop(1, '#040711');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 480, 760);

  // 2. Futuristic grid or ambient lines
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
  ctx.lineWidth = 1;
  // Vertical grid lines
  for (let x = 40; x < 480; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 760);
    ctx.stroke();
  }
  // Horizontal grid lines
  for (let y = 40; y < 760; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(480, y);
    ctx.stroke();
  }

  // Draw semi-circle radar overlays
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(240, 380, 220, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(240, 380, 150, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Glowing neon bracket corner notches
  const isApproved = school.status === 'approved';
  ctx.strokeStyle = isApproved ? '#3b82f6' : '#eab308'; // Blue for approved, yellow for pending
  ctx.lineWidth = 3.5;
  const gap = 20;
  const len = 20;
  // Top Left
  ctx.beginPath(); ctx.moveTo(gap, gap + len); ctx.lineTo(gap, gap); ctx.lineTo(gap + len, gap); ctx.stroke();
  // Top Right
  ctx.beginPath(); ctx.moveTo(480 - gap, gap + len); ctx.lineTo(480 - gap, gap); ctx.lineTo(480 - gap - len, gap); ctx.stroke();
  // Bottom Left
  ctx.beginPath(); ctx.moveTo(gap, 760 - gap - len); ctx.lineTo(gap, 760 - gap); ctx.lineTo(gap + len, 760 - gap); ctx.stroke();
  // Bottom Right
  ctx.beginPath(); ctx.moveTo(480 - gap, 760 - gap - len); ctx.lineTo(480 - gap, 760 - gap); ctx.lineTo(480 - gap - len, 760 - gap); ctx.stroke();

  // 4. Logo / Top Title Branding with App Logo
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous'; // prevent CORS canvas taint issues
  logoImg.src = 'https://i.ibb.co/hJp9jZb4/1000192206-imgupscaler-ai-General-8-K.jpg';
  
  await new Promise<void>((resolve) => {
    logoImg.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(240, 65, 25, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, 215, 40, 50, 50);
      ctx.restore();
      
      // Draw border ring
      ctx.strokeStyle = isApproved ? '#3b82f6' : '#eab308';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(240, 65, 25, 0, Math.PI * 2);
      ctx.stroke();
      resolve();
    };
    logoImg.onerror = () => {
      // Fallback
      ctx.fillStyle = isApproved ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)';
      ctx.beginPath();
      ctx.arc(240, 65, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isApproved ? '#3b82f6' : '#eab308';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(240, 65, 25, 0, Math.PI * 2);
      ctx.stroke();
      resolve();
    };
  });

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCIVERSE 2K26', 240, 118);

  ctx.fillStyle = isApproved ? '#60a5fa' : '#f59e0b';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.fillText(school.isSolo ? 'OFFICIAL SOLO STUDENT PASS' : 'OFFICIAL SCHOOL DELEGATION PASS', 240, 134);

  // Status Badge Pill Banner (Top right-ish or center under branding)
  const badgeW = 120;
  const badgeH = 24;
  const badgeX = 240 - badgeW / 2;
  const badgeY = 146;
  ctx.fillStyle = isApproved ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)';
  ctx.strokeStyle = isApproved ? 'rgba(34, 197, 94, 0.4)' : 'rgba(234, 179, 8, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
  } else {
    ctx.rect(badgeX, badgeY, badgeW, badgeH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isApproved ? '#4ade80' : '#facc15';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.fillText(isApproved ? '✓ APPROVED' : '⚡ PENDING', 240, badgeY + 15);

  // 5. Middle Section - QR Code & School Registration ID
  const qrValue = school.registrationId || school.id;
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    margin: 1.5,
    width: 180 * scale, // Scaled for high definition
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => {
      ctx.fillStyle = '#ffffff';
      const qSize = 180;
      const qX = 240 - qSize / 2;
      const qY = 190;
      
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(qX, qY, qSize, qSize, 12);
      } else {
        ctx.rect(qX, qY, qSize, qSize);
      }
      ctx.fill();
      
      ctx.strokeStyle = isApproved ? 'rgba(59, 130, 246, 0.4)' : 'rgba(234, 179, 8, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(qX - 6, qY - 6, qSize + 12, qSize + 12, 16);
      } else {
        ctx.rect(qX - 6, qY - 6, qSize + 12, qSize + 12);
      }
      ctx.stroke();

      ctx.drawImage(qrImage, qX + 8, qY + 8, qSize - 16, qSize - 16);
      resolve();
    };
    qrImage.onerror = (e) => reject(e);
  });

  // ID label beneath QR
  ctx.fillStyle = isApproved ? '#60a5fa' : '#f59e0b';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  const idText = school.registrationId || `TEMP-PEN-${school.id.slice(0, 6).toUpperCase()}`;
  ctx.fillText(idText, 240, 400);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.font = '500 8px "Space Grotesk", sans-serif';
  ctx.fillText(
    isApproved ? 'SCAN AT GATE TO AUTO-CHECK-IN' : 'PENDING OFFICIAL ADMISSION REVIEW',
    240,
    414
  );

  // Divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 435);
  ctx.lineTo(440, 435);
  ctx.stroke();

  // 6. Lower Section - Delegation Info
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Space Grotesk", system-ui, sans-serif';
  const endY = drawWrappedText(ctx, school.name.toUpperCase(), 240, 460, 400, 22);

  // Metadata block left-aligned inside limits
  const metaYStart = Math.max(endY + 25, 500);
  
  const items = school.isSolo ? [
    { label: 'SCHOOL', value: school.school || 'Private Registration' },
    { label: 'PARENT/GUARDIAN', value: school.parentName || 'Emergency Contact' },
    { label: 'PREFERRED TRACK', value: school.preferredDay || 'SciVerse Event Track' },
    { label: 'GATE ARRIVAL TIME', value: school.arrivalTime || 'To Be Scheduled' }
  ] : [
    { label: 'COORDINATOR', value: `${school.teacherInCharge || 'Not Configured'} ${school.teacherInChargePhone ? '• ' + school.teacherInChargePhone : ''}` },
    { label: 'PREFERRED TRACK', value: school.preferredDay || 'SciVerse Event Track' },
    { label: 'GATE ARRIVAL TIME', value: school.arrivalTime || 'To Be Scheduled' },
    { label: 'ROSTER ALLOTMENT', value: `${school.expectedStudents} Students  •  ${school.expectedTeachers} Teachers` }
  ];

  ctx.textAlign = 'left';
  items.forEach((item, index) => {
    const itemY = metaYStart + index * 44;
    if (itemY > 700) return;

    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText(item.label, 44, itemY);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '500 11px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(item.value, 44, itemY + 16);
  });

  // 7. Footer Watermark
  ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.font = 'bold 7px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('JAFFNA HINDU COLLEGE SCIENCE UNION  •  SCIVERSE SYMPOSIUM PASS', 240, 735);

  return canvas.toDataURL('image/png');
}

// React component to render a preview card and provide a trigger to download
interface SchoolPassCardProps {
  school: CardSchoolData;
  className?: string;
}

export const SchoolPassCard: React.FC<SchoolPassCardProps> = ({ school, className = '' }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await generatePassCardDataURL(school);
      const link = document.createElement('a');
      link.download = `${school.name.replace(/\s+/g, '_')}_SciVerse_2K26_Pass.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating pass card PNG:', err);
      alert('Error rendering pass card. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyId = () => {
    const idToCopy = school.registrationId || school.id;
    navigator.clipboard.writeText(idToCopy);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isApproved = school.status === 'approved';

  return (
    <div className={`p-5 bg-slate-900/90 border rounded-2xl space-y-4 backdrop-blur-md flex flex-col justify-between ${
      isApproved 
        ? 'border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]' 
        : 'border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.05)]'
    } ${className}`} id={`pass-card-${school.id}`}>
      
      {/* Visual Header */}
      <div className="flex justify-between items-start">
        <div className="flex gap-2.5 items-center">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
            isApproved ? 'bg-blue-500/10 text-blue-400' : 'bg-yellow-500/10 text-yellow-400'
          }`}>
            SV
          </div>
          <div>
            <h4 className="font-extrabold text-white text-xs tracking-wider uppercase font-mono">SciVerse 2K26</h4>
            <p className="text-[10px] text-slate-400">{school.isSolo ? 'Solo Student Pass' : 'JHC Science Union Pass'}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase border ${
          isApproved 
            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse'
        }`}>
          {isApproved ? 'Approved Pass' : 'Pending Review'}
        </span>
      </div>

      {/* Roster & Tracking Detail preview */}
      <div className="bg-slate-950/50 p-3.5 rounded-xl space-y-2 border border-white/5">
        <h5 className="font-bold text-white text-sm line-clamp-1">{school.name}</h5>
        <p className="text-[10px] text-slate-400 font-mono">TRACK: <span className="text-white font-sans">{school.preferredDay}</span></p>
        
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1 border-t border-white/5">
          {school.isSolo ? (
            <>
              <div>
                <p className="text-[8px] text-slate-500 font-mono uppercase">SCHOOL</p>
                <p className="text-slate-200 truncate font-medium">{school.school}</p>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 font-mono uppercase">PARENT</p>
                <p className="text-slate-200 truncate font-medium">{school.parentName}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[8px] text-slate-500 font-mono uppercase">COORDINATOR</p>
                <p className="text-slate-200 truncate font-medium">{school.teacherInCharge}</p>
                {school.teacherInChargePhone && (
                  <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5" title="Teacher Phone">{school.teacherInChargePhone}</p>
                )}
              </div>
              <div>
                <p className="text-[8px] text-slate-500 font-mono uppercase">CAPACITY ALLOTMENT</p>
                <p className="text-slate-200 font-mono">{school.expectedStudents} St. | {school.expectedTeachers} Te.</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ID Banner with direct copy action */}
      <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-white/5 font-mono text-[10px]">
        <div>
          <span className="text-slate-500">ID CODE:</span>{' '}
          <strong className="text-white tracking-widest text-xs font-semibold">
            {school.registrationId || 'PENDING'}
          </strong>
        </div>
        
        <button 
          onClick={handleCopyId}
          className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-white transition cursor-pointer"
          title="Copy Sign Code"
        >
          {copiedId ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Action triggers */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          className="w-full py-2.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-xl border border-blue-800 bg-blue-900 hover:bg-blue-850 text-white shadow-[0_4px_12px_rgba(30,58,138,0.4)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {isGenerating ? (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Rendering...
            </span>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Download PNG Pass
            </>
          )}
        </button>

        <a
          href="https://chat.whatsapp.com/LLz5gMnnPS79RgyCizDR0l"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-xl border border-green-500/30 bg-green-600 hover:bg-green-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(34,197,94,0.2)]"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Join WhatsApp Updates
        </a>
      </div>
    </div>
  );
};
