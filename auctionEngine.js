class AuctionEngine {
  constructor(players) {
    this.players = players;
    this.active = false;
    this.highestBid = 0;
    this.highestBidder = null;
  }

  start(propertyId) {
    this.active = true;
    this.propertyId = propertyId;
    this.highestBid = 0;
    this.highestBidder = null;
  }

  bid(player, amount) {
    if (amount > this.highestBid && amount <= player.money) {
      this.highestBid = amount;
      this.highestBidder = player.id;
      return true;
    }
    return false;
  }

  end() {
    this.active = false;
    return { winner: this.highestBidder, amount: this.highestBid };
  }
}

module.exports = AuctionEngine;

