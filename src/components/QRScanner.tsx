import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
}

export default function QRScanner({ onScanSuccess, onScanFailure }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerElementId = 'qr-reader';

  useEffect(() => {
    if (isScanning) {
      scannerRef.current = new Html5QrcodeScanner(
        scannerElementId,
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdge * 0.7);
            return {
              width: qrboxSize,
              height: qrboxSize
            };
          },
          aspectRatio: 1.0,
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          // Temporarily pause or stop after successful scan
          onScanSuccess(decodedText);
          handleStopScan();
        },
        (error) => {
          if (onScanFailure) {
            onScanFailure(error);
          }
        }
      );
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isScanning, onScanSuccess, onScanFailure]);

  const handleStopScan = () => {
    setIsScanning(false);
  };

  return (
    <div className="space-y-3 w-full">
      {!isScanning ? (
        <button
          type="button"
          onClick={() => setIsScanning(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold font-mono uppercase transition cursor-pointer border border-slate-600"
        >
          <Camera className="w-4 h-4" /> Open Camera Scanner
        </button>
      ) : (
        <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden relative">
          <div className="flex justify-between items-center p-3 border-b border-white/10 bg-slate-800/50">
            <span className="text-xs font-bold text-white uppercase font-mono">Scan QR Code</span>
            <button 
              type="button"
              onClick={handleStopScan}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div id={scannerElementId} className="w-full h-full min-h-[300px]"></div>
          {/* Add custom CSS to style the html5-qrcode elements */}
          <style dangerouslySetInnerHTML={{__html: `
            #qr-reader {
              width: 100%;
              border: none !important;
            }
            #qr-reader__scan_region {
              background: #0f172a;
            }
            #qr-reader__dashboard_section_csr span {
              color: #cbd5e1 !important;
            }
            #qr-reader__dashboard_section_csr button {
              background: #3b82f6 !important;
              color: white !important;
              border: none !important;
              padding: 6px 12px !important;
              border-radius: 6px !important;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
              font-size: 12px !important;
              text-transform: uppercase !important;
              font-weight: 700 !important;
              cursor: pointer !important;
            }
            #qr-reader__dashboard_section_swaplink {
              color: #60a5fa !important;
            }
          `}} />
        </div>
      )}
    </div>
  );
}
