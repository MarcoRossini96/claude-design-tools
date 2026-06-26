// Fixture JSX con violazioni intenzionali.
export function Card() {
  return (
    <div style={{ color: '#123456', fontFamily: 'Helvetica' }}>
      <h1>Titolo</h1>
      <h3>Sottotitolo saltato</h3>{/* wcag: h3 dopo h1 */}
      <img src="/logo.png" />{/* wcag: img senza alt */}
      <button><svg viewBox="0 0 16 16" /></button>{/* wcag: icon button senza aria-label */}
      <button aria-label="Chiudi"><svg /></button>{/* OK */}
    </div>
  );
}
