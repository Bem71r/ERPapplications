sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel"
], function (Controller, Filter, FilterOperator, Sorter, MessageToast, Fragment, JSONModel) {
  "use strict";

  return Controller.extend("my.apmorrowland.ordersapp.controller.OrdersList", {

    onInit: function () {
      this._bDateDesc = true;

      var oSel = this.byId("selStatus");
      if (oSel) { oSel.setSelectedKey("All"); }

      this._resetCreateModel();

      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteOrdersList")
        .attachPatternMatched(this._onListRouteMatched, this);
    },

    _onListRouteMatched: function () {
      this.onRefresh();
    },

    _resetCreateModel: function () {
      var oData = {
        customerId: "",
        orderType: "Tickets",
        paymentMethod: "Bancontact",
        currency_code: "EUR",
        totalAmount: 0,
        items: [
          { productId: "", qty: 1, unitPrice: 0, lineTotal: 0 }
        ],
        newCustomerMode: false,
        newCustomer: { firstName: "", lastName: "", email: "" }
      };

      var oCreateModel = new JSONModel(oData);
      oCreateModel.setDefaultBindingMode("TwoWay");
      this.getView().setModel(oCreateModel, "create");
    },

    _getListBinding: function () {
      return this.byId("ordersList").getBinding("items");
    },

    onRefresh: function () {
      var oBinding = this._getListBinding();
      if (oBinding) {
        oBinding.refresh();
        MessageToast.show("Refreshed");
      }
    },

    onSearch: function (oEvent) {
      var sQuery = (oEvent.getParameter("newValue") || oEvent.getParameter("query") || "").trim();
      var aFilters = [];

      if (sQuery) {
        aFilters.push(new Filter({
          and: false,
          filters: [
            new Filter("customer/firstName", FilterOperator.Contains, sQuery),
            new Filter("customer/lastName",  FilterOperator.Contains, sQuery),
            new Filter("status",             FilterOperator.Contains, sQuery)
          ]
        }));
      }

      var sStatus = this.byId("selStatus").getSelectedKey();
      if (sStatus && sStatus !== "All") {
        aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
      }

      this._getListBinding().filter(aFilters);
    },

    onFilterStatus: function () {
      var sQuery = this.byId("sfSearch") ? this.byId("sfSearch").getValue() : "";
      this.onSearch({ getParameter: function (n) { return n === "newValue" ? sQuery : ""; } });
    },

    onSortDate: function () {
      this._bDateDesc = !this._bDateDesc;
      this._getListBinding().sort(new Sorter("orderDate", this._bDateDesc));
      MessageToast.show(this._bDateDesc ? "Sorteer: nieuwste eerst" : "Sorteer: oudste eerst");
    },

    onItemPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext();
      if (!oCtx) {
        MessageToast.show("Geen binding context gevonden.");
        return;
      }

      var sPath = oCtx.getPath();
      var sOrderPath = encodeURIComponent(sPath.slice(1));

      this.getOwnerComponent().getRouter().navTo("RouteOrderDetail", {
        orderPath: sOrderPath
      });
    },

    /* =========================
       CREATE ORDER
       ========================= */

    onOpenCreateOrder: function () {
      var sViewId = this.getView().getId();

      this._resetCreateModel();

      if (this._oCreateDialog) {
        this._oCreateDialog.open();
        var sOrderType = this.getView().getModel("create").getProperty("/orderType");
        setTimeout(function () { this._applyProductFilterForOrderType(sOrderType); }.bind(this), 0);
        return;
      }

      Fragment.load({
        id: sViewId,
        name: "my.apmorrowland.ordersapp.fragment.CreateOrderDialog",
        controller: this
      }).then(function (oDialog) {
        this._oCreateDialog = oDialog;
        this.getView().addDependent(oDialog);
        oDialog.open();

        var sOrderType = this.getView().getModel("create").getProperty("/orderType");
        setTimeout(function () { this._applyProductFilterForOrderType(sOrderType); }.bind(this), 0);
      }.bind(this)).catch(function (e) {
        console.error(e);
        MessageToast.show("Kon Create dialog niet laden (zie console).");
      });
    },

    onCloseCreateOrder: function () {
      if (this._oCreateDialog) {
        this._oCreateDialog.close();
      }
    },

    /* ===== new customer ===== */

    onOpenNewCustomer: function () {
      this.getView().getModel("create").setProperty("/newCustomerMode", true);
    },

    onCancelNewCustomer: function () {
      var oCreate = this.getView().getModel("create");
      oCreate.setProperty("/newCustomerMode", false);
      oCreate.setProperty("/newCustomer", { firstName: "", lastName: "", email: "" });
    },

    onSaveNewCustomer: function () {
      var oCreate = this.getView().getModel("create");
      var oNC = oCreate.getProperty("/newCustomer") || {};

      var sFirst = (oNC.firstName || "").trim();
      var sLast  = (oNC.lastName || "").trim();
      var sEmail = (oNC.email || "").trim();

      if (!sFirst || !sLast) {
        MessageToast.show("Voornaam en achternaam zijn verplicht.");
        return;
      }
      if (sEmail && sEmail.indexOf("@") < 1) {
        MessageToast.show("E-mail lijkt niet geldig.");
        return;
      }

      var oModel = this.getView().getModel();
      var oListBinding = oModel.bindList("/Customers");
      var sViewId = this.getView().getId();

      var oCreatedCtx = oListBinding.create({
        firstName: sFirst,
        lastName: sLast,
        email: sEmail
      });

      oCreatedCtx.created()
        .then(function () {
          return oCreatedCtx.requestObject();
        })
        .then(function (oObj) {
          var sNewId = oObj && oObj.ID;
          if (!sNewId) {
            MessageToast.show("Nieuwe klant aangemaakt, maar ID ontbreekt.");
            return;
          }

          // 1) update model
          oCreate.setProperty("/customerId", sNewId);

          // 2) refresh Select items zodat nieuwe klant in de lijst staat
          var oSelCustomer = Fragment.byId(sViewId, "selCustomer");
          if (oSelCustomer) {
            var oItemsBinding = oSelCustomer.getBinding("items");
            if (oItemsBinding) {
              oItemsBinding.refresh();
            }
            // 3) force select key (visueel)
            oSelCustomer.setSelectedKey(sNewId);
          }

          // 4) close panel + reset inputs
          oCreate.setProperty("/newCustomerMode", false);
          oCreate.setProperty("/newCustomer", { firstName: "", lastName: "", email: "" });

          MessageToast.show("Nieuwe klant toegevoegd en geselecteerd.");
        })
        .catch(function (e) {
          console.error(e);
          MessageToast.show("Fout bij klant aanmaken (zie console).");
        });
    },

    /* ===== order type -> product filtering ===== */

    onOrderTypeChange: function (oEvent) {
      var sOrderType = oEvent.getSource().getSelectedKey();
      var oCreate = this.getView().getModel("create");

      oCreate.setProperty("/orderType", sOrderType);

      // Reset gekozen producten + totals
      var aItems = oCreate.getProperty("/items") || [];
      aItems.forEach(function (it) {
        it.productId = "";
        it.unitPrice = 0;
        it.lineTotal = 0;
      });
      oCreate.setProperty("/items", aItems);
      oCreate.setProperty("/totalAmount", 0);

      // Re-apply filter for ALL rows (after UI re-render)
      setTimeout(function () {
        this._applyProductFilterForOrderType(sOrderType);
      }.bind(this), 0);
    },

    _applyProductFilterForOrderType: function (sOrderType) {
      var sViewId = this.getView().getId();
      var oTable = Fragment.byId(sViewId, "tblItems");
      if (!oTable) { return; }

      var aRows = oTable.getItems() || [];
      aRows.forEach(function (oRow) {
        var aCells = oRow.getCells && oRow.getCells();
        if (!aCells || aCells.length === 0) { return; }

        var oProductSelect = aCells[0];
        var oBinding = oProductSelect && oProductSelect.getBinding && oProductSelect.getBinding("items");
        if (oBinding) {
          oBinding.filter([ new Filter("category", FilterOperator.EQ, sOrderType) ]);
        }
      });
    },

    onAddCreateItem: function () {
      var oCreate = this.getView().getModel("create");
      var aItems = oCreate.getProperty("/items") || [];
      aItems.push({ productId: "", qty: 1, unitPrice: 0, lineTotal: 0 });
      oCreate.setProperty("/items", aItems);

      var sOrderType = oCreate.getProperty("/orderType");
      setTimeout(function () { this._applyProductFilterForOrderType(sOrderType); }.bind(this), 0);

      this._recalcCreateTotals();
    },

    onDeleteCreateItem: function (oEvent) {
      var oCreate = this.getView().getModel("create");
      var aItems = oCreate.getProperty("/items") || [];

      var oItem = oEvent.getParameter("listItem");
      var oCtx = oItem.getBindingContext("create");
      var sPath = oCtx && oCtx.getPath();
      if (!sPath) { return; }

      var iIndex = parseInt(sPath.split("/").pop(), 10);
      if (!isNaN(iIndex)) {
        aItems.splice(iIndex, 1);
      }
      if (aItems.length === 0) {
        aItems.push({ productId: "", qty: 1, unitPrice: 0, lineTotal: 0 });
      }

      oCreate.setProperty("/items", aItems);

      var sOrderType = oCreate.getProperty("/orderType");
      setTimeout(function () { this._applyProductFilterForOrderType(sOrderType); }.bind(this), 0);

      this._recalcCreateTotals();
    },

    onRecalcCreateTotals: function () {
      this._recalcCreateTotals();
    },

    _recalcCreateTotals: function () {
      var oCreate = this.getView().getModel("create");
      var aItems = oCreate.getProperty("/items") || [];
      var oODataModel = this.getView().getModel();

      var aPromises = aItems.map(function (it) {
        var sProductId = it.productId;
        var iQty = parseInt(it.qty, 10) || 0;

        if (!sProductId || iQty <= 0) {
          it.unitPrice = 0;
          it.lineTotal = 0;
          return Promise.resolve();
        }

        return oODataModel.bindContext("/Products(" + sProductId + ")").requestObject()
          .then(function (oProduct) {
            var fUnit = Number(oProduct && oProduct.price ? oProduct.price : 0);
            it.unitPrice = fUnit;
            it.lineTotal = fUnit * iQty;
          });
      });

      Promise.all(aPromises)
        .then(function () {
          var fTotal = aItems.reduce(function (sum, it) {
            return sum + Number(it.lineTotal || 0);
          }, 0);

          oCreate.setProperty("/items", aItems);
          oCreate.setProperty("/totalAmount", fTotal);
        })
        .catch(function (e) {
          console.error(e);
          MessageToast.show("Kon totals niet berekenen (zie console).");
        });
    },

    onCreateOrder: function () {
      var oCreate = this.getView().getModel("create");
      var oData = oCreate.getData();

      if (!oData.customerId) {
        MessageToast.show("Kies een klant (of voeg een nieuwe klant toe).");
        return;
      }

      var aValidItems = (oData.items || []).filter(function (it) {
        var iQty = parseInt(it.qty, 10) || 0;
        return !!it.productId && iQty > 0;
      });

      if (aValidItems.length === 0) {
        MessageToast.show("Voeg minstens 1 geldig item toe (product + aantal).");
        return;
      }

      this._recalcCreateTotals();

      var oModel = this.getView().getModel();
      var oPayload = {
        orderDate: new Date().toISOString(),
        status: "Processing",
        orderType: oData.orderType,
        currency_code: oData.currency_code,
        customer_ID: oData.customerId,
        totalAmount: Number(oData.totalAmount || 0),
        items: aValidItems.map(function (it) {
          return {
            product_ID: it.productId,
            quantity: parseInt(it.qty, 10) || 0,
            unitPrice: Number(it.unitPrice || 0),
            lineTotal: Number(it.lineTotal || 0)
          };
        })
      };

      var oListBinding = oModel.bindList("/Orders");
      var oCreatedCtx = oListBinding.create(oPayload);

      oCreatedCtx.created()
        .then(function () {
          MessageToast.show("Order aangemaakt. Betaalmethode (simulatie): " + oData.paymentMethod);
          this.onCloseCreateOrder();
          this.onRefresh();
        }.bind(this))
        .catch(function (e) {
          console.error(e);
          MessageToast.show("Fout bij aanmaken order (zie console).");
        });
    }

  });
});
