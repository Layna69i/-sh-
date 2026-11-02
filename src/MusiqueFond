import { useEffect, useRef, useState } from "react";

export default function MusiqueFond() {
  const audioRef = useRef(null);
  const [actif, setActif] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.5;

    const events = ["pointerdown", "click", "keydown", "touchstart"];

    const retirer = () =>
      events.forEach((e) => window.removeEventListener(e, demarrer, true));

    const demarrer = () => {
      audio
        .play()
        .then(() => {
          setActif(true);
          retirer();
        })
        .catch((err) => console.log("Musique bloquée :", err));
    };

    events.forEach((e) => window.addEventListener(e, demarrer, true));
    return retirer;
  }, []);

  const basculer = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (audio.paused) {
      audio.play().then(() => setActif(true)).catch((err) => console.log(err));
    } else {
      audio.pause();
      setActif(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/sounds/musique.mp3.mp3" loop preload="auto" />
      <button
        onClick={basculer}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 99999,
          fontSize: 24,
          background: "rgba(0,0,0,0.6)",
          border: "none",
          borderRadius: "50%",
          width: 48,
          height: 48,
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        {actif ? "🔊" : "🔇"}
      </button>
    </>
  );
}
