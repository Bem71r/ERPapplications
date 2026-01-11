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
    },

    _resetCreateModel: function () {
      var oData = {
        customerId: "",
        orderType: "Tickets",
        currency_code: "EUR",
        totalAmount: 0,
        items: [
          { productId: "", qty: 1, unitPrice: 0, lineTotal: 0 }
        ]
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

      var sPath = oCtx.getPath(); // "/Orders(<uuid>)"
      var sOrderPath = encodeURIComponent(sPath.slice(1));

      this.getOwnerComponent().getRouter().navTo("RouteOrderDetail", {
        orderPath: sOrderPath
      });
    },

    /* =========================
       CREATE ORDER (Dialog)
       ========================= */

    onOpenCreateOrder: function () {
      var sViewId = this.getView().getId();

      // reset state elke keer dat je open doet (stabiel)
      this._resetCreateModel();

      if (this._oCreateDialog) {
        this._oCreateDialog.open();

        // Pas meteen filter toe op basis van default orderType
        var sOrderType = this.getView().getModel("create").getProperty("/orderType");
        this._applyProductFilterForOrderType(sOrderType);

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
        this._applyProductFilterForOrderType(sOrderType);
      }.bind(this)).catch(function (e) {
        /* eslint-disable no-console */
        console.error(e);
        MessageToast.show("Kon Create dialog niet laden (zie console).");
      });
    },

    onCloseCreateOrder: function () {
      if (this._oCreateDialog) {
        this._oCreateDialog.close();
      }
    },

    onOrderTypeChange: function (oEvent) {
      var sOrderType = oEvent.getSource().getSelectedKey();

      // update create model
      this.getView().getModel("create").setProperty("/orderType", sOrderType);

      // Filter products volgens gekozen type
      this._applyProductFilterForOrderType(sOrderType);

      // Reset alle gekozen producten (anders kan je een ticket-product in merch houden)
      var oCreate = this.getView().getModel("create");
      var aItems = oCreate.getProperty("/items") || [];
      aItems.forEach(function (it) {
        it.productId = "";
        it.unitPrice = 0;
        it.lineTotal = 0;
      });
      oCreate.setProperty("/items", aItems);
      oCreate.setProperty("/totalAmount", 0);
    },

    _applyProductFilterForOrderType: function (sOrderType) {
      var sViewId = this.getView().getId();

      // Product Select in fragment (de standalone bovenaan) bestaat niet; we filteren de items-select(s) in de table.
      // Omdat elke rij zijn eigen Select heeft, filteren we de binding op template-niveau door de eerste gevonden Select te nemen:
      // we pakken de Table en filteren via zijn items -> eerste row -> eerste cell (Select).
      var oTable = Fragment.byId(sViewId, "tblItems");
      if (!oTable) { return; }

      var aRows = oTable.getItems();
      if (!aRows || aRows.length === 0) { return; }

      var oFirstRow = aRows[0];
      var aCells = oFirstRow.getCells();
      if (!aCells || aCells.length === 0) { return; }

      var oProductSelect = aCells[0]; // eerste cell = Select
      var oBinding = oProductSelect.getBinding("items");
      if (!oBinding) { return; }

      // Mapping: orderType == category in Products
      var sCategory = sOrderType; // Tickets/Merch/Food

      oBinding.filter([ new Filter("category", FilterOperator.EQ, sCategory) ]);
    },

    onAddCreateItem: function () {
      var oCreate = this.getView().getModel("create");
      var aItems = oCreate.getProperty("/items") || [];
      aItems.push({ productId: "", qty: 1, unitPrice: 0, lineTotal: 0 });
      oCreate.setProperty("/items", aItems);

      // Zorg dat de filter ook geldt voor nieuwe rows (template binding)
      var sOrderType = oCreate.getProperty("/orderType");
      this._applyProductFilterForOrderType(sOrderType);

      this._recalcCreateTotals();
    },

    onDeleteCreateItem: function (oEvent) {
      var oCreate = this.getView().getModel("create");
      var aItems = oCreate.getProperty("/items") || [];

      var oItem = oEvent.getParameter("listItem");
      var oCtx = oItem.getBindingContext("create");
      var sPath = oCtx && oCtx.getPath(); // "/items/0"
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
      this._applyProductFilterForOrderType(sOrderType);

      this._recalcCreateTotals();
    },

    onRecalcCreateTotals: function () {
      this._recalcCreateTotals();
    },

    _recalcCreateTotals: function () {
      var oCreate = this.getView().getModel("create");
      var aItems = oCreate.getProperty("/items") || [];
      var oODataModel = this.getView().getModel(); // default OData V4 model

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
          /* eslint-disable no-console */
          console.error(e);
          MessageToast.show("Kon totals niet berekenen (zie console).");
        });
    },

    onCreateOrder: function () {
      var oCreate = this.getView().getModel("create");
      var oData = oCreate.getData();

      if (!oData.customerId) {
        MessageToast.show("Kies een klant.");
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

      // totals up-to-date
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
          MessageToast.show("Order aangemaakt.");
          this.onCloseCreateOrder();
          this.onRefresh();
        }.bind(this))
        .catch(function (e) {
          /* eslint-disable no-console */
          console.error(e);
          MessageToast.show("Fout bij aanmaken order (zie console).");
        });
    }

  });
});
