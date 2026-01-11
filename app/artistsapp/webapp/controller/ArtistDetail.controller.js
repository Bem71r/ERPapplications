sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel"
], function (Controller, Fragment, MessageToast, JSONModel) {
  "use strict";

  return Controller.extend("my.apmorrowland.artistsapp.controller.ArtistDetail", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        avgRatingText: "—",
        initials: "A",
        labelText: "Featured",
        labelState: "None",
        trendingText: "—",
        spotifyUrl: "",
        instagramUrl: ""
      }), "vm");

      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteArtistDetail")
        .attachPatternMatched(this._onMatched, this);
    },

    _onMatched: function (oEvent) {
      this._sArtistPathEncoded = oEvent.getParameter("arguments").artistPath;
      var sPath = "/" + decodeURIComponent(this._sArtistPathEncoded); // "/Artists(<uuid>)"

      this.getView().bindElement({
        path: sPath,
        parameters: {
          $expand: "reviews,performances($expand=stage,festivalDay)"
        },
        events: {
          dataReceived: function () {
            this._computeHeaderExtras();
            this._recalcAvgRating();
          }.bind(this)
        }
      });
    },

    _computeHeaderExtras: function () {
      var oCtx = this.getView().getBindingContext();
      if (!oCtx) return;

      var sName = oCtx.getProperty("name") || "";
      var iPop = Number(oCtx.getProperty("popularity") || 0);

      // Initials (max 2 chars)
      var aParts = sName.trim().split(/\s+/).filter(Boolean);
      var sInit = (aParts[0] ? aParts[0][0] : "A") + (aParts[1] ? aParts[1][0] : "");
      sInit = sInit.toUpperCase().slice(0, 2);

      // Label by popularity
      var sLabel = "Featured";
      var sState = "None";
      if (iPop >= 90) { sLabel = "Headliner"; sState = "Success"; }
      else if (iPop >= 80) { sLabel = "Rising Talent"; sState = "Warning"; }

      // Social links (search links, no schema needed)
      var sQ = encodeURIComponent(sName);
      var sSpotify = "https://open.spotify.com/search/" + sQ;
      var sInsta = "https://www.instagram.com/explore/search/keyword/?q=" + sQ;

      var oVM = this.getView().getModel("vm");
      oVM.setProperty("/initials", sInit);
      oVM.setProperty("/labelText", sLabel);
      oVM.setProperty("/labelState", sState);
      oVM.setProperty("/spotifyUrl", sSpotify);
      oVM.setProperty("/instagramUrl", sInsta);

      // trending (init; wordt opnieuw berekend na avg rating)
      oVM.setProperty("/trendingText", "Pop " + iPop + "/100");
    },

    _recalcAvgRating: function () {
      var oCtx = this.getView().getBindingContext();
      if (!oCtx) return;

      var aReviews = oCtx.getProperty("reviews") || [];
      var iPop = Number(oCtx.getProperty("popularity") || 0);
      var oVM = this.getView().getModel("vm");

      if (!aReviews.length) {
        oVM.setProperty("/avgRatingText", "— (0)");
        oVM.setProperty("/trendingText", "Score " + iPop + " (no reviews)");
        return;
      }

      var sum = aReviews.reduce(function (acc, r) { return acc + Number(r.rating || 0); }, 0);
      var avg = sum / aReviews.length;

      // Trending score (simple, coherent): popularity + rating impact
      var trending = (iPop * 0.6) + ((avg / 5) * 100 * 0.4);

      oVM.setProperty("/avgRatingText", avg.toFixed(2) + " (" + aReviews.length + ")");
      oVM.setProperty("/trendingText", "Score " + trending.toFixed(1) + "/100");
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteArtistsList");
    },

    onRefreshAll: function () {
      var oCtx = this.getView().getBindingContext();
      if (oCtx) {
        oCtx.refresh();
        MessageToast.show("Refreshed");
      }
      this._computeHeaderExtras();
      this._recalcAvgRating();
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
      if (this._oAddReviewDialog) this._oAddReviewDialog.close();
    },

    onSaveReview: function () {
      var oCtx = this.getView().getBindingContext();
      if (!oCtx) {
        MessageToast.show("Geen artist context gevonden.");
        return;
      }

      var sArtistId = oCtx.getProperty("ID");

      var sViewId = this.getView().getId();
      var oInpReviewer = Fragment.byId(sViewId, "inpReviewer");
      var oSelRating = Fragment.byId(sViewId, "selRating");
      var oTaComment = Fragment.byId(sViewId, "taComment");

      var sReviewer = (oInpReviewer.getValue() || "").trim();
      var iRating = parseInt(oSelRating.getSelectedKey(), 10) || 0;
      var sComment = (oTaComment.getValue() || "").trim();

      if (!sReviewer || iRating < 1 || iRating > 5) {
        MessageToast.show("Vul reviewer en rating (1-5) in. Comment is optioneel.");
        return;
      }

      var oModel = this.getView().getModel();
      var oLB = oModel.bindList("/Reviews");

      var oCreatedCtx = oLB.create({
        artist_ID: sArtistId,
        rating: iRating,
        comment: sComment,
        reviewerName: sReviewer,
        reviewDate: new Date().toISOString().slice(0, 10)
      });

      oCreatedCtx.created()
        .then(function () {
          MessageToast.show("Review opgeslagen.");
          oInpReviewer.setValue("");
          oTaComment.setValue("");
          oSelRating.setSelectedKey("5");

          this.onCloseAddReview();

          var oBCtx = this.getView().getBindingContext();
          if (oBCtx) oBCtx.refresh();

          this._computeHeaderExtras();
          this._recalcAvgRating();
        }.bind(this))
        .catch(function (e) {
          console.error(e);
          MessageToast.show("Fout bij opslaan review (zie console).");
        });
    }

  });
});
