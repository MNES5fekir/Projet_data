export default function ConsentBanner({ onChoose }) {
  return (
    <aside className="consent-banner" aria-label="Préférences de mesure d’audience">
      <div className="consent-copy">
        <strong>Mesure d’audience pseudonyme, avec votre accord.</strong>
        <p>Un cookie permet de compter vos visites et les sections consultées dans le temps. Il ne contient pas votre nom. Nous ne recueillons ni adresse IP dans les statistiques, ni nom de fichier, ni contenu CSV. Vous pouvez refuser ou retirer votre accord à tout moment.</p>
      </div>
      <div className="consent-actions">
        <button type="button" className="consent-reject" onClick={() => onChoose(false)}>Refuser</button>
        <button type="button" className="consent-accept" onClick={() => onChoose(true)}>Accepter les statistiques</button>
      </div>
    </aside>
  )
}
