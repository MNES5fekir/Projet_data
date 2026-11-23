export const CITIES = [
  'Dakar', 'Pikine', 'Guédiawaye', 'Rufisque', 'Keur Massar', 'Thiès', 'Mbour', 'Saint-Louis', 'Touba',
  'Diourbel', 'Kaolack', 'Fatick', 'Kaffrine', 'Louga', 'Ziguinchor', 'Kolda', 'Sédhiou',
  'Tambacounda', 'Kédougou', 'Matam',
];

export const SPECIALTIES = [
  'Grand boubou', 'Kaftan', 'Taille basse', 'Robe', 'Ensemble wax', 'Costume', 'Tenue de mariage',
  'Tenue de cérémonie', 'Broderie', 'Tenue enfant', 'Uniformes', 'Retouches',
];

export const AUDIENCES = ['femme', 'homme', 'enfant', 'mixte'];

export const PAYMENT_METHODS = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  free_money: 'Free Money',
  card: 'Carte bancaire',
};

/** Mensurations proposées (cm) */
export const MEASUREMENTS = [
  ['tour_cou', 'Tour de cou'],
  ['epaules', 'Largeur d’épaules'],
  ['poitrine', 'Tour de poitrine'],
  ['taille', 'Tour de taille'],
  ['hanches', 'Tour de hanches'],
  ['longueur_manche', 'Longueur de manche'],
  ['tour_bras', 'Tour de bras'],
  ['longueur_haut', 'Longueur du haut'],
  ['longueur_boubou', 'Longueur boubou / robe'],
  ['longueur_pantalon', 'Longueur pantalon / jupe'],
  ['tour_cuisse', 'Tour de cuisse'],
];

export const ORDER_STATUS = {
  requested: 'Demande envoyée',
  quoted: 'Devis reçu',
  paid: 'Payée',
  in_progress: 'En confection',
  ready: 'Prête / livrée',
  completed: 'Terminée',
  declined: 'Refusée',
  cancelled: 'Annulée',
  disputed: 'Litige',
  refunded: 'Remboursée',
};
