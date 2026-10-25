
import { useState } from "react";
import { supabase } from "./lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail = email.trim();

    if (mode === "signup" && !username.trim()) {
      setErrorMessage("Escribe el nombre que aparecerá en el chat.");
      return;
    }

    if (mode === "signup" && username.trim().length > 40) {
      setErrorMessage("Tu nombre admite hasta 40 caracteres.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setSuccessMessage("¡Cuenta creada! Bienvenido a NuestraSala ❤️");
        } else {
          setSuccessMessage(
            "Cuenta creada. Revisa tu correo y confirma tu dirección antes de iniciar sesión."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setErrorMessage(error.message || "No se pudo completar la operación.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (error) {
      setErrorMessage(
        error.message || "No se pudo iniciar sesión con Google."
      );
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <nav className="navbar">
        <a className="brand" href="#inicio">
          <span className="heart">♥</span>
          NuestraSala
        </a>
        <span className="online">Tu espacio juntos</span>
      </nav>

      <section className="hero" id="inicio">
        <div className="eyebrow">♡ UN LUGAR PARA LOS DOS ♡</div>

        <h1>
          La distancia se acorta
          <br />
          <span>cuando estamos juntos.</span>
        </h1>

        <p>
          {mode === "signup"
            ? "Crea tu cuenta y prepara tu espacio para compartir."
            : "Inicia sesión para volver a compartir momentos."}
        </p>

        <form
          className="video-form"
          onSubmit={handleSubmit}
          style={{
            maxWidth: "420px",
            margin: "28px auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Tu nombre para el chat"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={40}
              autoComplete="nickname"
              required
            />
          )}

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <input
            type="password"
            placeholder="Contraseña (mínimo 8 caracteres)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={8}
            required
          />

          <button className="primary" type="submit" disabled={loading}>
            {loading
              ? "Un momento..."
              : mode === "signup"
                ? "Crear mi cuenta ❤️"
                : "Iniciar sesión ↗"}
          </button>
        </form>

        {errorMessage && (
          <p role="alert" style={{ color: "#ff8c9b" }}>
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p role="status" style={{ color: "#b9edc5" }}>
            {successMessage}
          </p>
        )}

        <p>— o continúa con —</p>

        <button
          className="primary"
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          Continuar con Google
        </button>

        <p style={{ marginTop: "24px" }}>
          {mode === "signup"
            ? "¿Ya tienes una cuenta?"
            : "¿Todavía no tienes una cuenta?"}
        </p>

        <button
          type="button"
          className="primary"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setErrorMessage("");
            setSuccessMessage("");
          }}
        >
          {mode === "signup"
            ? "Iniciar sesión"
            : "Crear una cuenta nueva"}
        </button>
      </section>
    </main>
  );
}
