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
      var sOrderPathEncoded = oEvent.getParameter("arguments").orderPath;
      var sOrderPath = "/" + decodeURIComponent(sOrderPathEncoded);

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

      oCtx.setProperty("status", sNewStatus)
        .then(function () {
          MessageToast.show("Status opgeslagen: " + sNewStatus);
        })
        .catch(function (e) {
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

    onPrintOrder: function () {
      var oCtx = this.getView().getBindingContext();
      if (!oCtx || !oCtx.requestObject) {
        MessageToast.show("Order data nog niet beschikbaar.");
        return;
      }

      oCtx.requestObject().then(function (oOrder) {
        var sCustomer = ((oOrder.customer && oOrder.customer.firstName) || "") + " " + ((oOrder.customer && oOrder.customer.lastName) || "");
        var sDate = oOrder.orderDate || "";
        var sStatus = oOrder.status || "";
        var sType = oOrder.orderType || "";
        var sCur = oOrder.currency_code || "EUR";
        var fTotal = Number(oOrder.totalAmount || 0).toFixed(2);

        var aItems = (oOrder.items || []).map(function (it) {
          var sName = it.product && it.product.name ? it.product.name : "Item";
          var qty = it.quantity || 0;
          var unit = Number(it.unitPrice || 0).toFixed(2);
          var line = Number(it.lineTotal || 0).toFixed(2);
          return "<tr><td>" + sName + "</td><td style='text-align:right'>" + qty + "</td><td style='text-align:right'>" + unit + " " + sCur + "</td><td style='text-align:right'>" + line + " " + sCur + "</td></tr>";
        }).join("");

        var html =
          "<html><head><title>Order bevestiging</title>" +
          "<meta charset='utf-8'/>" +
          "<style>body{font-family:Arial;margin:24px} h2{margin:0 0 12px 0} table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border-bottom:1px solid #ddd;padding:8px} th{text-align:left}</style>" +
          "</head><body>" +
          "<h2>APMORROWLAND – Orderbevestiging</h2>" +
          "<div><b>Klant:</b> " + (sCustomer.trim() || "—") + "</div>" +
          "<div><b>Order type:</b> " + sType + "</div>" +
          "<div><b>Status:</b> " + sStatus + "</div>" +
          "<div><b>Datum:</b> " + sDate + "</div>" +
          "<table><thead><tr><th>Item</th><th style='text-align:right'>Qty</th><th style='text-align:right'>Unit</th><th style='text-align:right'>Subtotaal</th></tr></thead><tbody>" +
          aItems +
          "</tbody></table>" +
          "<h3 style='text-align:right;margin-top:12px'>Totaal: " + fTotal + " " + sCur + "</h3>" +
          "<script>window.onload=function(){window.print();}</script>" +
          "</body></html>";

        var w = window.open("", "_blank");
        if (!w) {
          MessageToast.show("Popup geblokkeerd. Sta popups toe om te printen.");
          return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
      });
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteOrdersList");
    }

  });
});
