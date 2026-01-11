sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, Sorter, MessageToast) {
  "use strict";

  return Controller.extend("my.apmorrowland.leaderboardapp.controller.Leaderboard", {

    onInit: function () {
      this._bRatingDesc = true; // start: desc
    },

    _getBinding: function () {
      return this.byId("lbList").getBinding("items");
    },

    onRefresh: function () {
      var oB = this._getBinding();
      if (oB) {
        oB.refresh();
        MessageToast.show("Refreshed");
      }
    },

    onSearch: function (oEvent) {
      var sQuery = (oEvent.getParameter("newValue") || oEvent.getParameter("query") || "").trim();
      this._applyAllFilters(sQuery);
    },

    onApplyFilters: function () {
      var sQuery = this.byId("sfSearch") ? this.byId("sfSearch").getValue() : "";
      this._applyAllFilters((sQuery || "").trim());
    },

    _applyAllFilters: function (sQuery) {
      var aFilters = [];

      if (sQuery) {
        aFilters.push(new Filter({
          and: false,
          filters: [
            new Filter("name", FilterOperator.Contains, sQuery),
            new Filter("genre", FilterOperator.Contains, sQuery),
            new Filter("country", FilterOperator.Contains, sQuery)
          ]
        }));
      }

      var iMin = parseInt(this.byId("inpMinReviews").getValue(), 10);
      if (!isNaN(iMin) && iMin > 0) {
        aFilters.push(new Filter("reviewCount", FilterOperator.GE, iMin));
      }

      this._getBinding().filter(aFilters);
    },

    onSort: function () {
      this._bRatingDesc = !this._bRatingDesc;
      this._getBinding().sort(new Sorter("avgRating", this._bRatingDesc));
      MessageToast.show(this._bRatingDesc ? "Sorteer: hoogste rating" : "Sorteer: laagste rating");
    }

  });
});
