sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("my.apmorrowland.artistsapp.controller.ArtistDetail", {

    onInit: function () {
      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteArtistDetail")
        .attachPatternMatched(this._onMatched, this);
    },

    _onMatched: function (oEvent) {
      var sEncoded = oEvent.getParameter("arguments").artistPath;
      var sPath = "/" + decodeURIComponent(sEncoded); // "/Artists(<uuid>)"

      this.getView().bindElement({
        path: sPath
      });
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteArtistsList");
    }

  });
});
