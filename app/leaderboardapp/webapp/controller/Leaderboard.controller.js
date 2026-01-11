sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("my.apmorrowland.leaderboardapp.controller.Leaderboard", {

    onInit: function () {
      this._bRatingDesc = true;

      this.getView().setModel(new JSONModel({
        all: [],
        reviewsByArtist: {},
        genres: [],
        selectedGenre: "",
        activeTab: "overall",
        itemsOverall: [],
        itemsGenre: []
      }), "vm");

      this._loadAllData();
    },

    _getAnalyticsModel: function () {
      return (this.getOwnerComponent && this.getOwnerComponent().getModel && this.getOwnerComponent().getModel())
        || this.getView().getModel();
    },

    _getAdminModel: function () {
      return this.getView().getModel("admin");
    },

    onRefresh: function () {
      this._loadAllData();
    },

    onSearch: function () {
      this._applyAll();
    },

    onApplyFilters: function () {
      this._applyAll();
    },

    onSort: function () {
      this._bRatingDesc = !this._bRatingDesc;
      this._applyAll();
      MessageToast.show(this._bRatingDesc ? "Sorteer: hoogste rating" : "Sorteer: laagste rating");
    },

    onTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      this.getView().getModel("vm").setProperty("/activeTab", sKey);
      this._applyAll();
    },

    onGenreChange: function (oEvent) {
      var sGenre = oEvent.getSource().getSelectedKey();
      this.getView().getModel("vm").setProperty("/selectedGenre", sGenre);
      this._applyAll();
    },

    _loadAllData: function () {
      var oAnalytics = this._getAnalyticsModel();
      var oAdmin = this._getAdminModel();
      if (!oAnalytics || !oAnalytics.bindList || !oAdmin || !oAdmin.bindList) return;

      var oVM = this.getView().getModel("vm");

      var pLeaderboard = oAnalytics
        .bindList("/Leaderboard", null, null, null, { $orderby: "avgRating desc" })
        .requestContexts(0, 1000)
        .then(function (aCtx) {
          var a = aCtx.map(function (c) { return c.getObject(); });
          a.forEach(function (x) {
            x.avgRating = x.avgRating == null ? 0 : Number(x.avgRating);
            x.reviewCount = x.reviewCount == null ? 0 : Number(x.reviewCount);
          });
          return a;
        });

      var pReviews = oAdmin
        .bindList("/Reviews", null, null, null, { $select: "artist_ID,rating,reviewDate" })
        .requestContexts(0, 5000)
        .then(function (aCtx) {
          return aCtx.map(function (c) { return c.getObject(); });
        });

      Promise.all([pLeaderboard, pReviews])
        .then(function (res) {
          var aLB = res[0] || [];
          var aReviews = res[1] || [];

          var m = {};
          aReviews.forEach(function (r) {
            var id = r.artist_ID;
            if (!id) return;
            if (!m[id]) m[id] = [];
            m[id].push({
              rating: Number(r.rating || 0),
              reviewDate: r.reviewDate || ""
            });
          });

          Object.keys(m).forEach(function (k) {
            m[k].sort(function (a, b) {
              return String(a.reviewDate).localeCompare(String(b.reviewDate));
            });
          });

          var mGenres = {};
          aLB.forEach(function (x) { if (x.genre) mGenres[x.genre] = true; });
          var aGenres = Object.keys(mGenres).sort().map(function (g) { return { key: g, text: g }; });

          oVM.setProperty("/all", aLB);
          oVM.setProperty("/reviewsByArtist", m);
          oVM.setProperty("/genres", aGenres);

          if (!oVM.getProperty("/selectedGenre") && aGenres.length) {
            oVM.setProperty("/selectedGenre", aGenres[0].key);
          }

          this._applyAll();
          MessageToast.show("Leaderboard loaded");
        }.bind(this))
        .catch(function (e) {
          console.error(e);
          MessageToast.show("Fout bij laden leaderboard/reviews (zie console).");
        });
    },

    _applyAll: function () {
      var oVM = this.getView().getModel("vm");
      var aAll = oVM.getProperty("/all") || [];
      var mReviews = oVM.getProperty("/reviewsByArtist") || {};

      var sQuery = (this.byId("sfSearch").getValue() || "").trim().toLowerCase();
      var iMin = parseInt(this.byId("inpMinReviews").getValue(), 10);
      if (isNaN(iMin)) iMin = 0;

      var aFiltered = aAll.filter(function (x) {
        var okQuery = true;
        if (sQuery) {
          okQuery =
            (x.name || "").toLowerCase().includes(sQuery) ||
            (x.genre || "").toLowerCase().includes(sQuery) ||
            (x.country || "").toLowerCase().includes(sQuery);
        }
        var okMin = Number(x.reviewCount || 0) >= iMin;
        return okQuery && okMin;
      });

      aFiltered.sort(function (a1, a2) {
        return this._bRatingDesc ? (a2.avgRating - a1.avgRating) : (a1.avgRating - a2.avgRating);
      }.bind(this));

      var aOverall = aFiltered.map(function (x, idx) {
        var rank = idx + 1;
        var badge = (rank === 1) ? "🥇" : (rank === 2) ? "🥈" : (rank === 3) ? "🥉" : "";
        return Object.assign({}, x, {
          rank: rank,
          badge: badge,
          trendPoints: this._buildTrendPoints(x.ID, x.avgRating, mReviews)
        });
      }.bind(this));

      var sGenre = oVM.getProperty("/selectedGenre") || "";
      var aGenre = aFiltered
        .filter(function (x) { return !sGenre || x.genre === sGenre; })
        .sort(function (a1, a2) {
          return this._bRatingDesc ? (a2.avgRating - a1.avgRating) : (a1.avgRating - a2.avgRating);
        }.bind(this))
        .map(function (x, idx) {
          var rank = idx + 1;
          var badge = (rank === 1) ? "🥇" : (rank === 2) ? "🥈" : (rank === 3) ? "🥉" : "";
          return Object.assign({}, x, {
            rank: rank,
            badge: badge,
            trendPoints: this._buildTrendPoints(x.ID, x.avgRating, mReviews)
          });
        }.bind(this));

      oVM.setProperty("/itemsOverall", aOverall);
      oVM.setProperty("/itemsGenre", aGenre);
    },

    _buildTrendPoints: function (artistId, avgRating, mReviews) {
      var a = (artistId && mReviews[artistId]) ? mReviews[artistId] : [];
      var base = Number(avgRating || 0);

      if (!a.length) {
        return [
          { x: 1, y: base },
          { x: 2, y: base }
        ];
      }

      var pts = [];
      var sum = 0;
      for (var i = 0; i < a.length; i++) {
        sum += Number(a[i].rating || 0);
        var cumAvg = sum / (i + 1);
        pts.push({
          x: i + 1, // FIX: number
          y: Number(cumAvg.toFixed(2))
        });
      }

      var last = pts.slice(Math.max(0, pts.length - 5));

      if (last.length === 1) {
        last = [{ x: 1, y: last[0].y }, { x: 2, y: last[0].y }];
      }

      return last;
    }

  });
});

