sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("my.apmorrowland.ordersapp.controller.OrderDetail", {

    onInit: function () {
      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteOrderDetail")
        .attachPatternMatched(this._onMatched, this);
    },

    _onMatched: function (oEvent) {
      var sOrderPathEncoded = oEvent.getParameter("arguments").orderPath; // encoded
      var sOrderPath = "/" + decodeURIComponent(sOrderPathEncoded);       // "/Orders(<uuid>)"

      this.getView().bindElement({
        path: sOrderPath,
        parameters: {
          $expand: "customer,items($expand=product)"
        }
      });
    },

    onSaveStatus: function () {
      var oCtx = this.getView().getBindingContext();
      if (!oCtx) {
        MessageToast.show("Geen order context gevonden.");
        return;
      }

      var sNewStatus = this.byId("selDetailStatus").getSelectedKey();

      // OData V4: setProperty triggert een PATCH (meestal via $auto group)
      oCtx.setProperty("status", sNewStatus)
        .then(function () {
          MessageToast.show("Status opgeslagen: " + sNewStatus);
        })
        .catch(function (e) {
          /* eslint-disable no-console */
          console.error(e);
          MessageToast.show("Fout bij opslaan status (zie console).");
        });
    },

    onRefreshDetail: function () {
      var oCtx = this.getView().getBindingContext();
      if (oCtx) {
        oCtx.refresh();
        MessageToast.show("Detail refreshed");
      }
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteOrdersList");
    }

  });
});
