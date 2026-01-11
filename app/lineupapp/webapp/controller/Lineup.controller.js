sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel",
  "sap/m/ResponsivePopover",
  "sap/m/VBox",
  "sap/m/Text"
], function (Controller, Filter, FilterOperator, Sorter, MessageToast, JSONModel, ResponsivePopover, VBox, Text) {
  "use strict";

  return Controller.extend("my.apmorrowland.lineupapp.controller.Lineup", {

    onInit: function () {
      this._bTimeDesc = false;

      // Calendar model (altijd beschikbaar)
      this.getView().setModel(new JSONModel({
        startDate: new Date(),
        rows: []
      }), "cal");

      // Wacht tot metadata klaar is, dan pas kalender bouwen
      var oModel = this._getODataModel();
      if (oModel && oModel.getMetaModel && oModel.getMetaModel().requestObject) {
        oModel.getMetaModel().requestObject("/").then(function () {
          this._buildCalendar();
        }.bind(this));
      }

      // Safety: als model later pas gezet wordt, bouw dan alsnog
      this.getView().attachModelContextChange(function () {
        this._buildCalendar();
      }.bind(this));
    },

    _getODataModel: function () {
      return (this.getOwnerComponent && this.getOwnerComponent().getModel && this.getOwnerComponent().getModel())
        || this.getView().getModel();
    },

    _getListBinding: function () {
      var oList = this.byId("perfList");
      return oList ? oList.getBinding("items") : null;
    },

    _applyFilters: function () {
      var sDayId = this.byId("cbDay").getSelectedKey();
      var sStageId = this.byId("cbStage").getSelectedKey();

      var aFilters = [];
      if (sDayId) aFilters.push(new Filter("festivalDay_ID", FilterOperator.EQ, sDayId));
      if (sStageId) aFilters.push(new Filter("stage_ID", FilterOperator.EQ, sStageId));

      var oBinding = this._getListBinding();
      if (oBinding) {
        oBinding.filter(aFilters);
      }

      // Kalender opnieuw opbouwen met dezelfde filters
      this._buildCalendar();
    },

    onFilterChange: function () {
      this._applyFilters();
    },

    onSortStartTime: function () {
      this._bTimeDesc = !this._bTimeDesc;

      var oBinding = this._getListBinding();
      if (oBinding) {
        oBinding.sort(new Sorter("startTime", this._bTimeDesc));
      }

      MessageToast.show(this._bTimeDesc ? "Sorteer: starttijd (desc)" : "Sorteer: starttijd (asc)");
    },

    onRefresh: function () {
      var oBinding = this._getListBinding();
      if (oBinding) oBinding.refresh();

      this._buildCalendar();
      MessageToast.show("Refreshed");
    },

    /* =========================
       Calendar builder
       ========================= */

    _buildCalendar: function () {
      var oModel = this._getODataModel();
      if (!oModel || !oModel.bindList) {
        // Model nog niet klaar -> geen crash
        return;
      }

      var oCal = this.getView().getModel("cal");
      if (!oCal) return;

      var sDayId = this.byId("cbDay") ? this.byId("cbDay").getSelectedKey() : "";
      var sStageId = this.byId("cbStage") ? this.byId("cbStage").getSelectedKey() : "";

      // Stages ophalen
      var pStages = oModel.bindList("/Stages").requestContexts(0, 200).then(function (aCtx) {
        var aStagesAll = aCtx.map(function (c) { return c.getObject(); });
        return sStageId ? aStagesAll.filter(function (st) { return st.ID === sStageId; }) : aStagesAll;
      });

      // Performances ophalen met expand + filters
      var aPerfFilters = [];
      if (sDayId) aPerfFilters.push(new Filter("festivalDay_ID", FilterOperator.EQ, sDayId));
      if (sStageId) aPerfFilters.push(new Filter("stage_ID", FilterOperator.EQ, sStageId));

      var pPerfs = oModel
        .bindList("/Performances", null, null, aPerfFilters, {
          $expand: "artist,stage,festivalDay",
          $orderby: "startTime asc"
        })
        .requestContexts(0, 500)
        .then(function (aCtx) {
          return aCtx.map(function (c) { return c.getObject(); });
        });

      Promise.all([pStages, pPerfs]).then(function (res) {
        var aStages = res[0] || [];
        var aPerfs = res[1] || [];

        // rows map per stage
        var mRows = {};
        aStages.forEach(function (st) {
          mRows[st.ID] = {
            stageId: st.ID,
            stageName: st.name,
            stageCapacity: st.capacity ? ("Cap: " + st.capacity) : "",
            appointments: []
          };
        });

        // startDate bepalen
        var dStart = new Date();
        for (var i = 0; i < aPerfs.length; i++) {
          if (aPerfs[i].festivalDay && aPerfs[i].festivalDay.day) {
            dStart = new Date(aPerfs[i].festivalDay.day);
            break;
          }
        }

        // appointments bouwen
        aPerfs.forEach(function (p) {
          if (!p.stage || !p.stage.ID || !mRows[p.stage.ID]) return;
          if (!p.festivalDay || !p.festivalDay.day) return;
          if (!p.startTime || !p.endTime) return;

          var dBase = new Date(p.festivalDay.day);

          var aST = String(p.startTime).split(":");
          var aET = String(p.endTime).split(":");

          var dS = new Date(dBase);
          dS.setHours(parseInt(aST[0], 10) || 0, parseInt(aST[1], 10) || 0, 0, 0);

          var dE = new Date(dBase);
          dE.setHours(parseInt(aET[0], 10) || 0, parseInt(aET[1], 10) || 0, 0, 0);

          var sArtist = p.artist && p.artist.name ? p.artist.name : "Artist";
          var sLabel = p.festivalDay && p.festivalDay.label ? p.festivalDay.label : "";
          var sStageName = p.stage && p.stage.name ? p.stage.name : "";

          var sType = "Type01";
          var sGenre = p.artist && p.artist.genre ? p.artist.genre : "";
          if (sGenre.indexOf("Techno") >= 0) sType = "Type02";
          else if (sGenre.indexOf("House") >= 0) sType = "Type03";
          else if (sGenre.indexOf("Rock") >= 0) sType = "Type04";

          mRows[p.stage.ID].appointments.push({
            title: sArtist,
            text: sLabel + (sStageName ? (" — " + sStageName) : ""),
            start: dS,
            end: dE,
            type: sType
          });
        });

        var aRows = Object.keys(mRows).map(function (k) { return mRows[k]; });
        oCal.setProperty("/startDate", dStart);
        oCal.setProperty("/rows", aRows);

      }).catch(function (e) {
        /* eslint-disable no-console */
        console.error(e);
        MessageToast.show("Kalender kon niet laden (zie console).");
      });
    },

    /* =========================
       Appointment popover (uitbreiding)
       ========================= */

    onAppointmentSelect: function (oEvent) {
      var oAppt = oEvent.getParameter("appointment");
      if (!oAppt) return;

      var sTitle = oAppt.getTitle();
      var sText = oAppt.getText();
      var dS = oAppt.getStartDate();
      var dE = oAppt.getEndDate();

      if (!this._oApptPopover) {
        this._oApptPopover = new ResponsivePopover({
          title: "Performance details",
          contentWidth: "24rem"
        });
        this.getView().addDependent(this._oApptPopover);
      }

      this._oApptPopover.removeAllContent();
      this._oApptPopover.addContent(new VBox({
        items: [
          new Text({ text: "Artist: " + sTitle }),
          new Text({ text: sText }),
          new Text({ text: "Start: " + (dS ? dS.toLocaleString() : "") }),
          new Text({ text: "End: " + (dE ? dE.toLocaleString() : "") })
        ]
      }));

      this._oApptPopover.openBy(oAppt);
    }

  });
});
