import { useEffect, useRef, useState } from "react";

export default function MusiqueFond() {
  const audioRef = useRef(null);
  const [actif, setActif] = useState(false);

  useEffect(() => {
    const demarrer = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.volume = 0.3;
      audio.play().then(() => setActif(true)).catch(() => {});
      window.removeEventListener("click", demarrer);
      window.removeEventListener("keydown", demarrer);
    };
    window.addEventListener("click", demarrer);
    window.addEventListener("keydown", demarrer);
    return () => {
      window.removeEventListener("click", demarrer);
      window.removeEventListener("keydown", demarrer);
    };
  }, []);

  const basculer = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (audio.paused) {
      audio.play();
      setActif(true);
    } else {
      audio.pause();
      setActif(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/sounds/musique.mp3.mp3" loop />
      <button
        onClick={basculer}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          fontSize: 24,
          background: "rgba(0,0,0,0.5)",
          border: "none",
          borderRadius: "50%",
          width: 48,
          height: 48,
          cursor: "pointer",
        }}
      >
        {actif ? "🔊" : "🔇"}
      </button>
    </>
  );
}
