
import { useState, useEffect, useRef } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";

export default function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState([]);
const [searching, setSearching] = useState(false);

  const playerInstanceRef = useRef(null);
  const roomCodeRef = useRef("");
  const applyingRemoteRef = useRef(false);
  const remoteTimeoutRef = useRef(null);
  const pendingPositionRef = useRef(0);
const pendingPlayingRef = useRef(false);
const pendingInitialSyncRef = useRef(false);
  const markRemoteChange = () => {
  applyingRemoteRef.current = true;

  if (remoteTimeoutRef.current) {
    window.clearTimeout(remoteTimeoutRef.current);
  }

  remoteTimeoutRef.current = window.setTimeout(() => {
    applyingRemoteRef.current = false;
    remoteTimeoutRef.current = null;
  }, 1000);
};

  roomCodeRef.current = roomCode;

  // Escuchar cambios en la sala
  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase
      .channel(`room-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const room = payload.new;

          if (room.video_id) {
            setVideoId((current) =>
              current === room.video_id ? current : room.video_id
            );
          }

          const player = playerInstanceRef.current;

          if (!player || !playerReady) return;

          try {
            const position = Number(room.playback_position) || 0;
            const currentPosition = player.getCurrentTime();
            const currentState = player.getPlayerState();

            if (Math.abs(currentPosition - position) > 3) {
              markRemoteChange();
player.seekTo(position, true);
            }

            if (room.is_playing && currentState !== 1) {
  markRemoteChange();
  player.playVideo();
} else if (!room.is_playing && currentState === 1) {
  markRemoteChange();
  player.pauseVideo();
}
          } catch (error) {
            console.error("Error sincronizando el reproductor:", error);
          }
        }
      )
      .subscribe((status) => {
        console.log("Estado de sincronización:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, playerReady]);

  // Inicializar el reproductor de YouTube
  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;

    function initializePlayer() {
      if (cancelled || !window.YT || !window.YT.Player) return;

      if (playerInstanceRef.current) {
  playerInstanceRef.current.loadVideoById(videoId);
  return;
}

      const container = document.getElementById("youtube-player");
      if (!container) return;

      playerInstanceRef.current = new window.YT.Player(
        "youtube-player",
        {
          width: "100%",
          height: "390",
          videoId,
         playerVars: {
  playsinline: 1,
  controls: 1,
  origin: window.location.origin,
},
          events: {
          
onReady: (event) => {
  if (cancelled) return;

  setPlayerReady(true);
  console.log("Reproductor de YouTube listo.");

  console.log("Video cargado:", event.target.getVideoUrl());
  console.log("Estado del video:", event.target.getPlayerState());
  console.log("Error del reproductor:", event.target.getPlayerState());

  if (!pendingInitialSyncRef.current) return;

  const player = event.target;
  const position = pendingPositionRef.current;
  const shouldPlay = pendingPlayingRef.current;

  pendingInitialSyncRef.current = false;

  markRemoteChange();

 if (position > 0) {
  player.seekTo(position, true);
}

if (shouldPlay) {
  player.playVideo();
} else {
  window.setTimeout(() => {
    if (!cancelled) {
      player.pauseVideo();
    }
  }, 1000);
}
},
onError: (event) => {
  console.error("Error de YouTube:", event.data);
},

            onStateChange: async (event) => {
              if (applyingRemoteRef.current) return;

              const player = playerInstanceRef.current;
              const code = roomCodeRef.current;

              if (!player || !code) return;

              if (event.data !== 1 && event.data !== 2) return;

              const isPlaying = event.data === 1;

              const { error } = await supabase
                .from("rooms")
                .update({
                  is_playing: isPlaying,
                  playback_position: player.getCurrentTime(),
                  updated_at: new Date().toISOString(),
                })
                .eq("room_code", code);

              if (error) {
                console.error(
                  "Error al guardar el estado del video:",
                  error
                );
              }
            },

            onError: (event) => {
              console.error("Error de YouTube:", event.data);
            },
          },
        }
      );
    }

    if (window.YT && window.YT.Player) {
      initializePlayer();
    } else {
      window.onYouTubeIframeAPIReady = initializePlayer;

      let script = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );

      if (!script) {
        script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Crear sala
  async function createRoom() {
    const code = Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();

    const { error } = await supabase.from("rooms").insert({
      room_code: code,
      is_playing: false,
      playback_position: 0,
    });

    if (error) {
      console.error(error);
      alert("No se pudo crear la sala.");
      return;
    }

    setRoomCode(code);
    setJoinCode("");
    setJoined(true);
    setVideoId("");
    setPlayerReady(false);
  }

  // Unirse a una sala
 
async function joinRoom(event) {
  event.preventDefault();

  const code = joinCode.trim().toUpperCase();

  if (!code) return;

  const { data, error } = await supabase
    .from("rooms")
    .select("room_code, video_id, playback_position, is_playing")
    .eq("room_code", code)
    .maybeSingle();

  if (error) {
    console.error(error);
    alert("No se pudo buscar la sala.");
    return;
  }

  if (!data) {
    alert("No existe una sala con ese código.");
    return;
  }

  setRoomCode(data.room_code);
  setVideoId(data.video_id || "");

  // Guardar el estado inicial para sincronizar el reproductor
  pendingPositionRef.current = Number(data.playback_position) || 0;
  pendingPlayingRef.current = Boolean(data.is_playing);
  pendingInitialSyncRef.current = true;

  setJoined(true);
  setPlayerReady(false);
}

  // Compartir video de YouTube
  async function loadVideo(event) {
    event.preventDefault();

    if (!roomCode) {
      alert("Primero crea una sala o únete a una.");
      return;
    }

    try {
      const url = new URL(videoUrl.trim());
      let id = "";

      if (url.hostname === "youtu.be") {
        id = url.pathname.slice(1).split("/")[0];
      } else if (
        url.hostname === "youtube.com" ||
        url.hostname.endsWith(".youtube.com") ||
        url.hostname === "youtube-nocookie.com" ||
        url.hostname.endsWith(".youtube-nocookie.com")
      ) {
        id =
          url.searchParams.get("v") ||
          url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ||
          "";
      }

      if (!/^[\w-]{11}$/.test(id)) {
        alert("Pega un enlace válido de YouTube.");
        return;
      }

      const { error } = await supabase
        .from("rooms")
        .update({
          video_id: id,
          is_playing: false,
          playback_position: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("room_code", roomCode);

      if (error) {
        console.error(error);
        alert("No se pudo sincronizar el video.");
        return;
      }

      setPlayerReady(false);
      setVideoId(id);
    } catch {
      alert("Revisa el enlace e inténtalo otra vez.");
    }
  }

async function searchYouTube(event) {
  event.preventDefault();

  const query = searchQuery.trim();
  if (!query) return;

  setSearching(true);
  setSearchResults([]);

  try {
    const key = import.meta.env.VITE_YOUTUBE_API_KEY;
    console.log(
  "¿Se cargó la clave de YouTube?",
  Boolean(import.meta.env.VITE_YOUTUBE_API_KEY)
);

    if (!key) {
      alert("Falta configurar la clave de YouTube en .env.local.");
      return;
    }

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "8",
      q: query,
      key,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Error de YouTube:", data);
      alert(data.error?.message || "No se pudo buscar en YouTube.");
      return;
    }

    setSearchResults(
      (data.items || []).map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url,
      }))
    );

    if (!data.items?.length) {
      alert("No encontramos videos con esa búsqueda.");
    }
  } catch (error) {
    console.error(error);
    alert("Error al buscar videos. Revisa tu conexión.");
  } finally {
    setSearching(false);
  }
}



async function selectSearchResult(id) {
  if (!roomCode) {
    alert("Primero crea una sala o únete a una.");
    return;
  }

  const { error } = await supabase
    .from("rooms")
    .update({
      video_id: id,
      is_playing: false,
      playback_position: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("room_code", roomCode);

  if (error) {
    console.error(error);
    alert("No se pudo sincronizar el video.");
    return;
  }

  setVideoUrl("");
  setPlayerReady(false);
  setVideoId(id);
}



  return (
    <main className="app">
      <nav className="navbar">
        <a className="brand" href="#inicio">
          <span className="heart">♥</span>
          NuestraSala
        </a>
        <span className="online">
          <span className="dot" /> Tu espacio juntos
        </span>
      </nav>

      <section className="hero" id="inicio">
        <div className="eyebrow">♡ UN LUGAR PARA LOS DOS ♡</div>

        <h1>
          La distancia se acorta
          <br />
          <span>cuando estamos juntos.</span>
        </h1>

        <p>
          Películas, videos y momentos especiales.
          <br />
          Una sala hecha para compartir contigo.
        </p>

        <button className="primary" onClick={createRoom}>
          Crear nuestra sala <span>↗</span>
        </button>

        {roomCode && (
          <div className="room-code">
            <span>Tu código de sala</span>
            <strong>{roomCode}</strong>
            <small>Comparte este código con tu pareja.</small>
          </div>
        )}

        <div className="join-room">
          <p>¿Ya tienen una sala?</p>

          <form onSubmit={joinRoom}>
            <input
              type="text"
              placeholder="Código de la sala"
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
              maxLength={6}
              required
            />
            <button className="primary" type="submit">
              Unirme a la sala ↗
            </button>
          </form>

          {joined && (
            <p className="join-success">
              ¡Estás en la sala {roomCode}! ❤️
            </p>
          )}
        </div>
      </section>

      <section className="watch">
        <div className="section-heading">
          <div>
            <span className="eyebrow">NOCHE DE PELÍCULA</span>
            <h2>Nuestra pantalla</h2>
            
          </div>
          <span className="private">♡ Un espacio para compartir</span>
        </div>

<div className="youtube-search">
  <form className="video-form" onSubmit={searchYouTube}>
    <input
      type="search"
      placeholder="Busca canciones, videos..."
      value={searchQuery}
      onChange={(event) => setSearchQuery(event.target.value)}
      required
    />

    <button className="primary" type="submit" disabled={searching}>
      {searching ? "Buscando..." : "Buscar en YouTube ↗"}
    </button>
  </form>

  {searchResults.length > 0 && (
    <div className="search-results">
      {searchResults.map((video) => (
        <button
          className="search-result"
          key={video.id}
          type="button"
          onClick={() => selectSearchResult(video.id)}
        >
          <img src={video.thumbnail} alt="" />

          <span>
            <strong>{video.title}</strong>
            <small>{video.channel}</small>
          </span>
        </button>
      ))}
    </div>
  )}
</div>

        <div className="player">
          {videoId ? (
            <div id="youtube-player" />
          ) : (
            <div className="placeholder">
              <div className="play">▶</div>
              <h3>¿Qué vamos a ver hoy?</h3>
              <p>Elige un video de YouTube para empezar.</p>
            </div>
          )}
        </div>

        <form className="video-form" onSubmit={loadVideo}>
          <input
            type="url"
            placeholder="Pega aquí un enlace de YouTube..."
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            required
          />
          <button className="primary" type="submit">
            Compartir video ↗
          </button>
        </form>

        <p className="note">
          Cuando alguien comparte un video, el video seleccionado se actualiza
          en los dispositivos conectados a la misma sala.
        </p>
      </section>

      <footer>
        <a className="brand" href="#inicio">
          <span className="heart">♥</span>
          NuestraSala
        </a>
        <span>Hecho con cariño, para compartir momentos. ♡</span>
          </footer>
    </main>
  );
}
