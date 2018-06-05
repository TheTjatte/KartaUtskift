sel = function(selector) {
  var elements = document.querySelectorAll(selector);

  return elements.length > 1 ? elements : elements[0];
}

function Print(options) {
  for (var o in options ) {
    this[o] = options[o];
  }

  this.orientation = "landscape";
  this.pageSizes = { portrait: { w: 595, h: 842}, landscape: { w: 842, h: 595} };

  sel("[name=orientation]").forEach(function(el) {
    el.addEventListener("change", function(e) {
      this.rotate(e.target.value);
    }.bind(this));
  }.bind(this));

  sel("#btn-download-pdf").addEventListener("click", function(e) { this.downloadPdf() }.bind(this));
  sel("#btn-add-text").addEventListener("click", function(e) {
    var label = sel("#txt-text").value,
        fontSize = sel("#txt-size") ? sel("#txt-size").value + "px" : "24px",
        fontFamily = sel("#txt-font") ? sel("#txt-font").value : "Arial";

    this.addTextOverlay(label, fontFamily, fontSize);
    this.updateLayout();
    event.target.closest(".submenu").classList.add("hidden");
  }.bind(this));

  this.initMenu();
  this.initFilePicker();
  this.renderMap();
  this.setLayout(this.layout);
  this.handleBackgroundChange();
}

Print.prototype = {
  setLayout: function(layout) {
    if (layout.overlays && layout.overlays.length > 0) {
      for (var i = 0; i < layout.overlays.length; i++) {
        var ol = layout.overlays[i];

        if (ol.type === "text") {
          this.addTextOverlay(ol.text, ol.font, ol.size, ol.x, ol.y, ol.width, ol.height);
        }

        if (ol.type === "image") {
          this.addImageOverlay(ol.img, ol.x, ol.y, ol.width, ol.height);
        }
      }
    }

    this.renderGallery();
  },

  updateLayout: function() {
    this.layout.overlays = [];
    var overlays = document.querySelectorAll(".overlay");
    for (var i = 0; i < overlays.length; i++) {
      var o = overlays[i], ol = {};

      if (o.querySelector(".text")) {
        var span = o.querySelector("span");
        ol.type = "text";
        ol.text = span.innerHTML;
        ol.font = span.style.fontFamily;
        ol.size = span.style.fontSize;
      }

      if (o.querySelector(".image")) {
        ol.type = "image";
        ol.img = o.querySelector(".image").src;
      }

      ol.x = o.getAttribute("data-offset-x");
      ol.y = o.getAttribute("data-offset-y");
      ol.width = o.clientWidth;
      ol.height = o.clientHeight;

      this.layout.overlays.push(ol);
    }

    this.layoutChangedCallback(this.layout);
  },

  initMenu: function() {
    var menuButtons = sel("#toolbar li img");
    for (var i = 0; i < menuButtons.length; i++) {
      menuButtons[i].addEventListener("click", function(event) {
        var submenu = event.target.nextElementSibling;
        if (!submenu) return;

        if (submenu.className.indexOf("hidden") > -1) {
          //hide all other submenues
          var menues = document.querySelectorAll(".submenu");
          for (var j = 0; j < menues.length; j++) {
            menues[j].classList.add("hidden");
          }

          submenu.classList.remove("hidden");
        } else {
          submenu.classList.add("hidden");
        }
      });
    }

    var closeButtons = sel(".close");
    for (var i = 0; i < closeButtons.length; i++) {
      closeButtons[i].addEventListener("click", function(event) {
        event.target.parentElement.classList.add("hidden");
      });
    }
  },

  initFilePicker: function() {
    var dropArea = sel(".drop-area");
    dropArea.addEventListener("dragover", function(e) {
      e.preventDefault();
      e.currentTarget.classList.add("hover");
    });

    dropArea.addEventListener("dragenter", function(e) {
      e.preventDefault();
    });

    dropArea.addEventListener("dragleave", function(e) {
      e.currentTarget.classList.remove("hover");
    });

    dropArea.addEventListener("drop", function(e) {
      e.preventDefault();
      e.currentTarget.classList.remove("hover");
      var files = [];
      for (var i = 0; i < e.dataTransfer.items.length; i++) {
        files.push(e.dataTransfer.items[i].getAsFile());
      }

      this.userImageSelectedCallback(files);
    }.bind(this));

    sel("#select-file-trigger").addEventListener("click", function(e) {
      e.preventDefault();
      e.currentTarget.nextElementSibling.click();
    });

    sel(".drop-area input[type=file]").addEventListener("change", function(e) {
      this.userImageSelectedCallback(e.target.files);
    }.bind(this));
  },

  renderGallery: function() {
    if (this.layout && this.layout.gallery) {
      var gallery = sel("#image-gallery");
      gallery.innerHTML = "";
      for (var i = 0; i < this.layout.gallery.length; i++) {
        var img = document.createElement("img");
        img.src = this.layout.gallery[i];
        img.style.width = "50px";
        img.addEventListener("click", function(e) {
          this.addImageOverlay(e.target.src);
          this.updateLayout();
          event.target.closest(".submenu").classList.add("hidden");
        }.bind(this));

        gallery.appendChild(img)
      }
    }
  },

  handleBackgroundChange: function() {
    var bgSwitches = sel("[name=bg-map]");
    for (var i = 0; i < bgSwitches.length; i++) {
      bgSwitches[i].addEventListener("change", function(event) {
        this.map.getLayers().forEach(function(l) {
          if (l.get("id") !== "features" && l.get("id") !== event.target.value) {
            l.setVisible(false);
          } else {
            l.setVisible(true);
          }
        });
      }.bind(this));
    }
  },

  renderMap: function() {
    this.source = new ol.source.Vector({
      features: (new ol.format.GeoJSON()).readFeatures(this.data, {
       dataProjection: 'EPSG:4326',
       featureProjection: 'EPSG:3857'
      })
    });

    this.featuresLayer = new ol.layer.Vector({
      id: "features",
      source: this.source,
      style: (feature) => this.getStyle(feature)
    });

    var backgrounds = ["satellite", "streets-satellite", "streets"], layers = [];

    for (var i = 0; i < backgrounds.length; i++) {
      layers.push(new ol.layer.Tile({
        visible: false, id: backgrounds[i],
        source: new ol.source.XYZ({
          maxZoom: 17, crossOrigin: 'anonymous',
          url: "https://api.tiles.mapbox.com/v4/mapbox." + backgrounds[i] + "/{z}/{x}/{y}.png?access_token=" + "<mapbox_token>"
        })
      }));
    }

    layers.push(this.featuresLayer);
    this.map = new ol.Map({
     target: "map",
     controls: ol.control.defaults({ zoom: false, attribution: false }).extend([new ol.control.ScaleLine()]),
     layers: layers,
     view: new ol.View({ maxZoom: 24 })
    });

    this.map.getView().fit(this.source.getExtent(), this.map.getSize(), { padding: [100,100,100,100] });
  },

  getStyle: function(feature) {
    var props = feature.getProperties();
    var stroke = new ol.style.Stroke({
      color:  props["_StrokeColor"] ? props["_StrokeColor"] : "red",
      width: props["_StrokeWidth"] ? props["_StrokeWidth"] : 2,
    });

    var fill = new ol.style.Fill({
      color: props["_Color"] ? props["_Color"] : "white",
    });

    var image = new ol.style.Circle({
      radius: 5,
      stroke : stroke,
      fill: fill
    });

    var text = new ol.style.Text({
      text: props["_Text"] ? props["_Text"] : "",
      offsetX: props["_TextX"] ? props["_TextX"] : 0,
      offsetY: props["_TextY"] ? props["_TextY"] : 0
    });

    return new ol.style.Style({
      stroke: stroke,
      fill: fill,
      image: image,
      text: text
    });

    return style;
  },

  rotate: function(orientation) {
    this.orientation = orientation;
    this.el.style.width = this.pageSizes[orientation].w + "px";
    this.el.style.height = this.pageSizes[orientation].h + "px";

    var overlays = document.querySelectorAll(".overlay");
    for (var i = 0; i < overlays.length; i++) {
      var o = overlays[i],
          x = parseInt(o.getAttribute("data-offset-x")),
          y = parseInt(o.getAttribute("data-offset-y")),
          x_delta, y_delta = 0;

      if ((x + o.clientWidth) > o.parentElement.clientWidth) {
        var x_pos = o.parentElement.clientWidth - o.clientWidth;
        x_delta = x_pos - x;
        o.style.left = x_pos + "px";
        o.setAttribute("data-offset-x", x_pos);
      }

      if ((y + o.clientHeight) > o.parentElement.clientHeight) {
        var y_pos = o.parentElement.clientHeight - o.clientHeight;
        y_delta = y_pos - y;
        o.style.top = y_pos + "px";
        o.setAttribute("data-offset-y", y_pos);
      }

      var transform = o.style.transform.substring(10, o.style.transform.length-1);
      if (transform) {
        var tx = parseInt(transform.split("px,")[0]),
            new_tx = tx + x_delta,
            ty = parseInt(transform.split("px,")[1].split("px")[0]),
            new_ty = ty + y_delta;

        o.style.webkitTransform =
        o.style.transform = "translate(" + new_tx + "px, " + new_ty + "px)";
        o.setAttribute("data-x", new_tx);
        o.setAttribute("data-y", new_ty);
      }
    }

    this.map.updateSize();
  },

  addTextOverlay: function(label, fontFamily, fontSize, x, y, width, height) {
    if (label) {
      var div = document.createElement("div");
      div.className = "overlay";
      div.style.top = y ? y + "px" : "0px";
      div.style.left = x ? x + "px" : "0px";
      div.style.width = width + "px";
      div.style.height = height + "px";
      div.setAttribute("data-offset-x", x || 0);
      div.setAttribute("data-offset-y", y || 0);
      this.addCloseButton(div);

      var textWrapper = document.createElement("div");
      textWrapper.classList.add("text");
      textWrapper.style.height = height-40 + "px";
      textWrapper.style.lineHeight = height-40 + "px";
      div.appendChild(textWrapper);

      var text = document.createElement("span");
      text.innerHTML = label;
      text.style.fontSize = fontSize;
      text.style.fontFamily = fontFamily;
      text.setAttribute("data-size", fontSize);
      text.setAttribute("data-font", fontFamily);
      textWrapper.appendChild(text);
      sel("#map").appendChild(div);

      this.makeDraggable();
    }
  },

  addImageOverlay: function(path, x, y, width, height) {
    var div = document.createElement("div");
    div.classList.add("overlay");
    div.style.maxWidth = "500px";
    div.style.top = y ? y + "px" : "0px";
    div.style.left = x ? x + "px" : "0px";
    div.style.width = width + "px";
    div.style.height = height + "px";
    div.setAttribute("data-offset-x", x || 0);
    div.setAttribute("data-offset-y", y || 0);
    this.addCloseButton(div);

    var img = document.createElement("img");
    img.className = "image";
    img.src = path;
    img.style.width = "100%";
    img.crossOrigin = "anonymous";
    div.appendChild(img)
    sel("#map").appendChild(div);

    this.makeDraggable();
  },

  addCloseButton: function(div) {
    var close = document.createElement("img");
    close.src = "img/close.svg";
    close.className = "close";
    close.addEventListener("click", function() {
      div.parentElement.removeChild(div);
      this.updateLayout();
    }.bind(this));
    div.appendChild(close);
  },

  makeDraggable: function() {
    interact(".overlay").draggable({
      restrict: { restriction: "parent", elementRect: { top: 0, left: 0, bottom: 1, right: 1 } },
      onmove: this.moveElement,
      onend: function (event) { this.updateLayout() }.bind(this)
    })
    .resizable({
      edges: { left: false, right: true, bottom: true, top: false },
      restrictEdges: { outer: 'parent', endOnly: true },
      restrictSize: { min: { width: 100, height: 50 } }
    })
    .on("resizemove", this.resizeElement)
    .on("resizeend", this.updateLayout.bind(this));
  },

  moveElement: function (event) {
    var target = event.target,
        x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx,
        y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;

    target.style.webkitTransform =
    target.style.transform = "translate(" + x + "px, " + y + "px)";
    target.setAttribute("data-offset-x", parseInt(target.style.left.split("px")[0]) + x);
    target.setAttribute("data-offset-y", parseInt(target.style.top.split("px")[0]) + y);
    target.setAttribute("data-x", x);
    target.setAttribute("data-y", y);
  },

  resizeElement: function (event) {
    var target = event.target,
        x = (parseFloat(target.getAttribute('data-x')) || 0),
        y = (parseFloat(target.getAttribute('data-y')) || 0);

    target.style.width  = event.rect.width + 'px';
    target.style.height = event.rect.height + 'px';
    x += event.deltaRect.left;
    y += event.deltaRect.top;

    target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);

    //center text vertically
    var text = target.querySelector(".text"),
        height = event.rect.height - 40;

    if (text) {
      text.style.height = height + "px";
      text.style.lineHeight = height + "px";
    }
  },

  downloadPdf: function() {
    var doc = new jsPDF({ orientation: this.orientation });

    this.map.once('postcompose', function(event) {
      var canvas = event.context.canvas,
          ctx = canvas.getContext('2d'),
          overlays = document.querySelectorAll(".overlay");

      for (var i = 0; i < overlays.length; i++) {
        this.renderOverlayToCanvas(overlays[i], ctx);
      }

      doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 0, 0,
        this.px2mm(this.pageWidth()), this.px2mm(this.pageHeight()));
      doc.save('a4.pdf');

      //remove overlays drawn on map canvas
      this.map.renderSync();

    }.bind(this));

    this.map.renderSync();
  },

  renderOverlayToCanvas: function(el, ctx) {
    var offsetX = parseInt(el.getAttribute("data-offset-x"));
        offsetY = parseInt(el.getAttribute("data-offset-y"));

    if (el.querySelector(".text")) {
      var text = el.querySelector(".text span"),
          fontSize = text.getAttribute("data-size").split("px")[0];

      ctx.lineWidth = 1;
      ctx.strokeStyle = "#EFEFEF"
      ctx.strokeRect(offsetX, offsetY, el.clientWidth, el.clientHeight);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(offsetX, offsetY, el.clientWidth, el.clientHeight);
      ctx.fillStyle = "#000000";
      ctx.font = fontSize + "px " + text.getAttribute("data-font");
      ctx.fillText(text.innerText, offsetX + text.offsetLeft, offsetY + text.offsetTop + parseInt(fontSize));
    }

    if (el.querySelector(".image")) {
      var img = el.querySelector(".image");

      ctx.drawImage(img, offsetX, offsetY);
    }
  },

  pageWidth: function() {
    return this.pageSizes[this.orientation].w;
  },

  pageHeight: function() {
    return this.pageSizes[this.orientation].h;
  },

  px2mm: function(px) {
    return Math.round(px * 0.35294);
  }
}
