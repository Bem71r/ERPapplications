sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment"
], function (Controller, Filter, FilterOperator, Sorter, MessageToast, Fragment) {
  "use strict";

  return Controller.extend("my.apmorrowland.artistsapp.controller.ArtistsList", {

    onInit: function () {
      this._bPopDesc = true;

      var oG = this.byId("selGenre");
      if (oG) oG.setSelectedKey("All");
      var oC = this.byId("selCountry");
      if (oC) oC.setSelectedKey("All");
    },

    _getListBinding: function () {
      return this.byId("artistsList").getBinding("items");
    },

    onRefresh: function () {
      var oB = this._getListBinding();
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
      var sQuery = this.byId("sfArtist") ? this.byId("sfArtist").getValue() : "";
      this._applyAllFilters((sQuery || "").trim());
    },

    _applyAllFilters: function (sQuery) {
      var aFilters = [];

      if (sQuery) {
        aFilters.push(new Filter({
          and: false,
          filters: [
            new Filter("name", FilterOperator.Contains, sQuery)
          ]
        }));
      }

      var sGenre = this.byId("selGenre").getSelectedKey();
      if (sGenre && sGenre !== "All") {
        aFilters.push(new Filter("genre", FilterOperator.EQ, sGenre));
      }

      var sCountry = this.byId("selCountry").getSelectedKey();
      if (sCountry && sCountry !== "All") {
        aFilters.push(new Filter("country", FilterOperator.EQ, sCountry));
      }

      this._getListBinding().filter(aFilters);
    },

    onSortPopularity: function () {
      this._bPopDesc = !this._bPopDesc;
      this._getListBinding().sort(new Sorter("popularity", this._bPopDesc));
      MessageToast.show(this._bPopDesc ? "Sorteer: populariteit (hoog->laag)" : "Sorteer: populariteit (laag->hoog)");
    },

    onItemPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext();
      if (!oCtx) return;

      var sPath = oCtx.getPath(); // "/Artists(<uuid>)"
      var sArtistPath = encodeURIComponent(sPath.slice(1));

      this.getOwnerComponent().getRouter().navTo("RouteArtistDetail", {
        artistPath: sArtistPath
      });
    },

    /* ===== Nieuwe artiest + eerste performance ===== */

    onOpenAddArtist: function () {
      var sViewId = this.getView().getId();

      if (this._oAddArtistDialog) {
        this._oAddArtistDialog.open();
        return;
      }

      Fragment.load({
        id: sViewId,
        name: "my.apmorrowland.artistsapp.fragment.AddArtistDialog",
        controller: this
      }).then(function (oDialog) {
        this._oAddArtistDialog = oDialog;
        this.getView().addDependent(oDialog);
        oDialog.open();
      }.bind(this)).catch(function (e) {
        console.error(e);
        MessageToast.show("Kon Add Artist dialog niet laden (zie console).");
      });
    },

    onCloseAddArtist: function () {
      if (this._oAddArtistDialog) this._oAddArtistDialog.close();
    },

    onSaveArtist: function () {
      var sViewId = this.getView().getId();

      var oName = Fragment.byId(sViewId, "inpAName");
      var oGenre = Fragment.byId(sViewId, "inpAGenre");
      var oCountry = Fragment.byId(sViewId, "inpACountry");
      var oPop = Fragment.byId(sViewId, "inpAPop");
      var oBio = Fragment.byId(sViewId, "taABio");

      var oDay = Fragment.byId(sViewId, "selDay");
      var oStage = Fragment.byId(sViewId, "selStage");
      var oStart = Fragment.byId(sViewId, "inpStart");
      var oEnd = Fragment.byId(sViewId, "inpEnd");

      var sName = (oName.getValue() || "").trim();
      var sGen = (oGenre.getValue() || "").trim();
      var sCou = (oCountry.getValue() || "").trim();
      var iPop = parseInt(oPop.getValue(), 10);
      if (isNaN(iPop)) iPop = 50;
      var sBio = (oBio.getValue() || "").trim();

      var sDayId = oDay.getSelectedKey();
      var sStageId = oStage.getSelectedKey();

      var sST = (oStart.getValue() || "").trim(); // "HH:MM"
      var sET = (oEnd.getValue() || "").trim();

      if (!sName || !sGen || !sCou) {
        MessageToast.show("Vul naam, genre en land in.");
        return;
      }
      if (!sDayId || !sStageId || !sST || !sET) {
        MessageToast.show("Kies festivaldag/stage en vul start & end tijd in.");
        return;
      }
      // Normaliseer naar HH:MM:SS
      if (sST.length === 5) sST = sST + ":00";
      if (sET.length === 5) sET = sET + ":00";

      var oModel = this.getView().getModel();

      // 1) Artist create
      var oArtistsLB = oModel.bindList("/Artists");
      var oCreatedArtistCtx = oArtistsLB.create({
        name: sName,
        genre: sGen,
        country: sCou,
        popularity: iPop,
        bio: sBio
      });

      oCreatedArtistCtx.created()
        .then(function () {
          return oCreatedArtistCtx.requestObject();
        })
        .then(function (oArtistObj) {
          var sArtistId = oArtistObj && oArtistObj.ID;
          if (!sArtistId) throw new Error("Artist ID missing after create");

          // 2) Performance create (koppelt meteen aan line-up)
          var oPerfLB = oModel.bindList("/Performances");
          var oCreatedPerfCtx = oPerfLB.create({
            artist_ID: sArtistId,
            stage_ID: sStageId,
            festivalDay_ID: sDayId,
            startTime: sST,
            endTime: sET
          });

          return oCreatedPerfCtx.created();
        }.bind(this))
        .then(function () {
          MessageToast.show("Artiest + eerste performance opgeslagen.");
          this.onCloseAddArtist();
          this.onRefresh();
        }.bind(this))
        .catch(function (e) {
          console.error(e);
          MessageToast.show("Fout bij opslaan artiest/performance (zie console).");
        });
    }

  });
});
