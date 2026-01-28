module.exports = {
  GO_BONUS: 1500,
  JAIL_FINE: 300,

  tiles: [
    { id: 0, type: "GO", name: "GO" },

    { id: 1, type: "PROPERTY", name: "Saket", price: 3200, rent: 260, group: "orange" },
    { id: 2, type: "CHANCE", name: "Chance" },
    { id: 3, type: "PROPERTY", name: "Hauz Khas", price: 3400, rent: 300, group: "orange" },

    { id: 4, type: "TAX", name: "Income Tax", amount: 400 },

    { id: 5, type: "JAIL_VISIT", name: "Tihar Jail" },

    { id: 6, type: "PROPERTY", name: "Laxmi Nagar", price: 2800, rent: 220, group: "blue" },
    { id: 7, type: "CHANCE", name: "Chance" },
    { id: 8, type: "PROPERTY", name: "Shahdara", price: 3000, rent: 250, group: "blue" },

    { id: 9, type: "FREE", name: "MCD Parking" },

    { id: 10, type: "GO_TO_JAIL", name: "Go To Tihar Jail" },

    // (Pattern continues until 39 – expandable)
  ]
};

