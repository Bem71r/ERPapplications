sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/m/MessageToast"
], function (Controller, Fragment, MessageToast) {
  "use strict";

  return Controller.extend("my.apmorrowland.artistsapp.controller.ArtistDetail", {

    onInit: function () {
      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteArtistDetail")
        .attachPatternMatched(this._onMatched, this);
    },

    _onMatched: function (oEvent) {
      this._sArtistPathEncoded = oEvent.getParameter("arguments").artistPath;
      var sPath = "/" + decodeURIComponent(this._sArtistPathEncoded); // "/Artists(<uuid>)"

      // Bind artist + expand reviews
      this.getView().bindElement({
        path: sPath,
        parameters: {
          $expand: "reviews"
        }
      });
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteArtistsList");
    },

    onRefreshReviews: function () {
      var oCtx = this.getView().getBindingContext();
      if (oCtx) {
        oCtx.refresh();
        MessageToast.show("Refreshed");
      }
    },

    onOpenAddReview: function () {
      var sViewId = this.getView().getId();

      if (this._oAddReviewDialog) {
        this._oAddReviewDialog.open();
        return;
      }

      Fragment.load({
        id: sViewId,
        name: "my.apmorrowland.artistsapp.fragment.AddReviewDialog",
        controller: this
      }).then(function (oDialog) {
        this._oAddReviewDialog = oDialog;
        this.getView().addDependent(oDialog);
        oDialog.open();
      }.bind(this)).catch(function (e) {
        console.error(e);
        MessageToast.show("Kon review dialog niet laden (zie console).");
      });
    },

    onCloseAddReview: function () {
      if (this._oAddReviewDialog) {
        this._oAddReviewDialog.close();
      }
    },

    onSaveReview: function () {
      var oCtx = this.getView().getBindingContext();
      if (!oCtx) {
        MessageToast.show("Geen artist context gevonden.");
        return;
      }

      // Artist ID uit huidige context
      var sArtistId = oCtx.getProperty("ID");

      var sViewId = this.getView().getId();
      var oInpReviewer = Fragment.byId(sViewId, "inpReviewer");
      var oSelRating = Fragment.byId(sViewId, "selRating");
      var oTaComment = Fragment.byId(sViewId, "taComment");

      var sReviewer = (oInpReviewer.getValue() || "").trim();
      var iRating = parseInt(oSelRating.getSelectedKey(), 10) || 0;
      var sComment = (oTaComment.getValue() || "").trim();

      if (!sReviewer || !sComment || iRating < 1 || iRating > 5) {
        MessageToast.show("Vul reviewer, comment en rating (1-5) in.");
        return;
      }

      var oModel = this.getView().getModel();
      var oListBinding = oModel.bindList("/Reviews");

      var oCreatedCtx = oListBinding.create({
        artist_ID: sArtistId,
        rating: iRating,
        comment: sComment,
        reviewerName: sReviewer,
        reviewDate: new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      });

      oCreatedCtx.created()
        .then(function () {
          MessageToast.show("Review opgeslagen.");
          // reset inputs
          oInpReviewer.setValue("");
          oTaComment.setValue("");
          oSelRating.setSelectedKey("5");

          this.onCloseAddReview();
          this.onRefreshReviews();
        }.bind(this))
        .catch(function (e) {
          console.error(e);
          MessageToast.show("Fout bij opslaan review (zie console).");
        });
    }

  });
});
