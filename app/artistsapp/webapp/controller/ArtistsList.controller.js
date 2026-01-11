sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("my.apmorrowland.artistsapp.controller.ArtistsList", {

    _getListBinding: function () {
      return this.byId("artistsList").getBinding("items");
    },

    onSearch: function (oEvent) {
      var sQuery = (oEvent.getParameter("newValue") || oEvent.getParameter("query") || "").trim();
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

      this._getListBinding().filter(aFilters);
    },

    onItemPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext();
      if (!oCtx) { return; }

      // "/Artists(<uuid>)"
      var sPath = oCtx.getPath();
      var sArtistPath = encodeURIComponent(sPath.slice(1)); // "Artists(<uuid>)"

      this.getOwnerComponent().getRouter().navTo("RouteArtistDetail", {
        artistPath: sArtistPath
      });
    }

  });
});
