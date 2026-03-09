import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { motion, AnimatePresence } from "framer-motion";

interface ActivityItem {
  id: number;
  user: string;
  action: string;
  location: string;
  time: string;
  lat: number;
  lng: number;
}

const mockActivities: ActivityItem[] = [
  { id: 1, user: "Sarah Chen", action: "Updated API_KEY in production", location: "San Francisco", time: "Just now", lat: 37.7749, lng: -122.4194 },
  { id: 2, user: "Alex Kumar", action: "Synced database credentials", location: "Mumbai", time: "Just now", lat: 19.0760, lng: 72.8777 },
  { id: 3, user: "Emma Wilson", action: "Added new environment variables", location: "London", time: "Just now", lat: 51.5074, lng: -0.1278 },
  { id: 4, user: "Carlos Rodriguez", action: "Rotated JWT secrets", location: "São Paulo", time: "Just now", lat: -23.5505, lng: -46.6333 },
  { id: 5, user: "Yuki Tanaka", action: "Updated staging config", location: "Tokyo", time: "Just now", lat: 35.6762, lng: 139.6503 },
  { id: 6, user: "David Kim", action: "Deployed new secrets", location: "Seoul", time: "Just now", lat: 37.5665, lng: 126.9780 },
];

const Globe = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<any>(null);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentActivityIndex((prev) => (prev + 1) % mockActivities.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let currentWidth = 0;
    const onResize = () => {
      if (canvasRef.current) {
        currentWidth = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    let phi = 0;
    
    const createMarkers = (activeIndex: number) => 
      mockActivities.map((activity, index) => ({
        location: [activity.lat, activity.lng] as [number, number],
        size: index === activeIndex ? 0.08 : 0.04,
      }));
    
    // Using a dynamic internal resolution tracking via resize listener
    globeRef.current = createGlobe(canvasRef.current!, {
      devicePixelRatio: 2,
      width: currentWidth * 2,
      height: currentWidth * 2,
      phi: 0,
      theta: 0.1,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.1, 0.1, 0.1],
      markerColor: [0.1, 0.8, 0.5],
      glowColor: [0.1, 0.1, 0.1],
      markers: createMarkers(currentActivityIndex),
      onRender: (state) => {
        // Slower, smoother rotation
        phi += 0.003;
        state.phi = phi;
        // Dynamically update the WebGL boundaries on every frame to prevent clipping when CSS scales down
        state.width = currentWidth * 2;
        state.height = currentWidth * 2;
      }
    });

    return () => {
      window.removeEventListener('resize', onResize);
      if (globeRef.current) {
        globeRef.current.destroy();
        globeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      const newMarkers = mockActivities.map((activity, index) => ({
        location: [activity.lat, activity.lng] as [number, number],
        size: index === currentActivityIndex ? 0.08 : 0.03,
      }));
      
      globeRef.current.updateMarkers?.(newMarkers);
    }
  }, [currentActivityIndex]);

  const activeActivity = mockActivities[currentActivityIndex];

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-transparent z-10 pointer-events-none" />
      
      {/* Activity Popup Overlay */}
      <div className="absolute z-20 top-0 sm:top-2 left-1/2 -translate-x-1/2 w-[95%] max-w-[280px] sm:max-w-[340px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentActivityIndex}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-[#0d1117]/80 backdrop-blur-md border border-emerald-500/20 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)] rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg">
              {activeActivity.user.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <p className="text-sm font-semibold text-white truncate">{activeActivity.user}</p>
                <span className="text-xs text-emerald-400 shrink-0 ml-2">{activeActivity.time}</span>
              </div>
              <p className="text-xs text-neutral-400 truncate">{activeActivity.action}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="w-full flex items-center justify-center opacity-80 mt-8 sm:mt-0"
      >
        <canvas
          ref={canvasRef}
          className="w-full max-w-[300px] sm:max-w-[350px] md:max-w-[400px] lg:max-w-[450px] xl:max-w-[500px] aspect-square"
          style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
        />
      </motion.div>
    </div>
  );
};

export default Globe;
