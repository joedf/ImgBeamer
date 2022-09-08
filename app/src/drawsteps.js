function drawBaseBeam(stage) {
	// create our shape
	var beam = new Konva.Circle({
		x: stage.width() / 2,
		y: stage.height() / 2,
		radius: 70,
		fill: 'white',
		strokeWidth: 0,
	});

	var layer = stages[0].getLayers()[0];
	layer.add(beam);
	layer.draw();

	return beam;
}

function drawBaseImage(stage, oImg, size, doFill = false) {
	var max = size;

	console.log("img natural size:", oImg.naturalWidth, oImg.naturalHeight);
	var img_width = oImg.naturalWidth, img_height = oImg.naturalHeight;

	// image ratio to "fit" in canvas
	var ratio = (img_width > img_height ? (img_width / max) : (img_height / max)) // fit
	if (doFill){
		ratio = (img_width > img_height ? (img_height / max) : (img_width / max)) // fill
	}

	var iw = img_width/ratio, ih = img_height/ratio;
	var kImage = new Konva.Image({
		x: (max - iw)/2,
		y: (max - ih)/2,
		image: oImg,
		width: iw, 
		height: ih,
	});

	stage.getLayers()[0].add(kImage);

	stage.draw();

	return kImage;
}

function drawBaseComposite(stage, sImage, sBeam, updateCallback) {
	var layer = stage.getLayers()[0];
	layer.listening(true);

	// Give yellow box border to indicate interactive
	$(stage.getContainer()).css('border-color','yellow')

	var beam = sBeam.clone();
	var image = sImage.clone();
	image.draggable(true);
	
	image.globalCompositeOperation(COMPOSITE_OP);

	layer.add(beam);
	layer.add(image);

	// "pre-zoom" a bit, and start with center position
	scaleOnCenter(stage, image, 1, 4);

	layer.draw();

	var doUpdate = function(){
		if (typeof updateCallback == 'function')
			return updateCallback();
	};

	// Events
	image.on('mouseup', function() { doUpdate(); });
	image.on('dragmove', function() { stage.draw(); });
	image.on('wheel', function(e){
		// modified from https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html 
		e.evt.preventDefault(); // stop default scrolling
		
		var scaleBy = 1.2;
		
		// Do half rate scaling, if shift is pressed
		if (e.evt.shiftKey) {
			scaleBy = 1 +((scaleBy-1) / 2);
		}

		// how to scale? Zoom in? Or zoom out?
		let direction = e.evt.deltaY > 0 ? -1 : 1;
		var oldScale = image.scaleX();
		var pointer = stage.getPointerPosition();
		var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
		
		scaleCenteredOnPoint(pointer, image, oldScale, newScale);

		stage.draw();

		doUpdate();
	});

	return image;
}

function drawAvgCircle(sourceStage, destStage, sBeam) {
	var sourceLayer = sourceStage.getLayers()[0];
	var destLayer = destStage.getLayers()[0];

	var updateAvgCircle = function(){
		var pCtx = sourceLayer.getContext();
		var allPx = pCtx.getImageData(0, 0, pCtx.canvas.width, pCtx.canvas.height);
		var avgPx = get_avg_pixel_rgba(allPx);

		var avgCircle = null;
		if (destLayer.getChildren().length <= 0){
			avgCircle = sBeam.clone();
			destLayer.add(avgCircle);
		} else {
			avgCircle = destLayer.getChildren()[0];
		}

		var avgColor = "rgba("+ avgPx.join(',') +")";
		avgCircle.stroke(avgColor);
		avgCircle.fill(avgColor);

		destStage.getContainer().setAttribute('pixel_value', avgColor);

		destLayer.draw();
	};

	// run once immediately
	updateAvgCircle();

	return updateAvgCircle;
}

function drawProbeLayout(drawStage, baseImage, userImage, beam) {
	// draws probe layout
	var layers = drawStage.getLayers();
	var baseLayer = layers[0];

	baseLayer.add(baseImage);
	baseLayer.draw();

	var updateProbeLayout = function(){
		// get the over-layer, create if not already added
		var gridLayer = null;
		var gridDrawn = false;
		if (layers.length < 2) {
			gridLayer = new Konva.Layer();
			drawStage.add(gridLayer);
		} else {
			gridLayer = layers[1];
			gridDrawn = true; // assume we drew it already
		}

		// get probe layer, make a new if not already there
		var probesLayer = null;
		if (layers.length < 3) {
			probesLayer = new Konva.Layer();
			drawStage.add(probesLayer);
		} else {
			probesLayer = layers[2];
		}

		///////////////////////////////
		// Do drawing work ...

		var tRows = getRowsInput();
		var tCols = getColsInput();
		
		// uncomment to draw grid only once
		gridDrawn = false; gridLayer.destroyChildren();

		// draw grid on base/source image
		if (!gridDrawn)
			drawGrid(gridLayer, baseImage, tRows, tCols);
		
		// clear the probe layer
		probesLayer.destroyChildren();

		var probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / userImage.scaleX()) / 2, //(cell.width/2) * .8,
				y : (beam.height() / userImage.scaleY()) / 2 //(cell.height/2) * .8
			},
			fill: 'rgba(255,0,0,.4)',
			strokeWidth: 1,
			stroke: 'red'
		});
		
		repeatDrawOnGrid(probesLayer, baseImage, probe, tRows, tCols);
	};

	// run once immediately
	updateProbeLayout();

	return updateProbeLayout;
}

function drawProbeLayoutSampling(drawStage, originalImage, userImage, sBeam) {
	var baseImage = originalImage.clone();
	var beam = sBeam.clone();

	/*
	// prep a canvas and context
	var _imgObj = originalImage.image();
	var processingStage = createOffscreenStage(_imgObj.naturalWidth, _imgObj.naturalHeight, 2);
	var rImageBase = new Konva.Image({
		x: 0, y: 0, image: _imgObj,
		width: _imgObj.naturalWidth, 
		height: _imgObj.naturalHeight,
	});
	processingStage.getLayers()[0].add(rImageBase);
	rImageBase.cache();
	*/

	var updateProbeLayoutSampling = function(){
		var rows = getRowsInput();
		var cols = getColsInput();

		var probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / userImage.scaleX()) / 2,
				y : (beam.height() / userImage.scaleY()) / 2
			},
			fill: 'white',
			listening: false,
		});

		computeResampledPreview(drawStage, baseImage, probe, rows, cols);

		drawStage.draw();
	};

	// run once immediately
	updateProbeLayoutSampling();

	return updateProbeLayoutSampling;
}

function drawResampled(sourceStage, destStage, originalImage, userImage, sBeam) {
	var baseImage = originalImage.clone();
	var beam = sBeam.clone();

	var updateResampledDraw = function(){
		var rows = getRowsInput();
		var cols = getColsInput();

		var probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / userImage.scaleX()) / 2,
				y : (beam.height() / userImage.scaleY()) / 2
			},
			fill: 'white',
			listening: false,
		});

		computeResampled(sourceStage, destStage, baseImage, probe, rows, cols);

		destStage.draw();
	};

	// run once immediately
	updateResampledDraw();

	return updateResampledDraw;
}
