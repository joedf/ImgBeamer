const INPUT_IMAGE = 'src/testimages/grains1b.png';
const COMPOSITE_OP = 'source-in';
// const COMPOSITE_OP = 'destination-in';
var G_UpdateResampled = null;

const nStages = 7;
// var sz = 300;
var sz = (document.body.clientWidth / 4) - (4 * 5);
var mc = $('#main-container');


// first create the stages
var stages = [];
for (let i = 0; i < nStages; i++) {
	var stage = newStageTemplate(mc, sz, sz);
	stages.push(stage);
}

// create our shape
var circle = new Konva.Circle({
	x: stage.width() / 2,
	y: stage.height() / 2,
	radius: 70,
	fill: 'white',
	strokeWidth: 0,
});

var s1l = stages[0].getLayers()[0];
s1l.add(circle);
s1l.draw();

/////////////////////

var G_MAIN_GRAIN_ORIGINAL = null;

loadImage(INPUT_IMAGE, function(event){
	var imageObj = event.target;

	var max = sz;

	console.log("img natural size:", imageObj.naturalWidth, imageObj.naturalHeight);
	var img_width = imageObj.naturalWidth, img_height = imageObj.naturalHeight;

	// image ratio to "fit" in canvas
	var doFill = false;
	var ratio = (img_width > img_height ? (img_width / max) : (img_height / max)) // fit
	if (doFill){
		ratio = (img_width > img_height ? (img_height / max) : (img_width / max)) // fill
	}

	var iw = img_width/ratio, ih = img_height/ratio;
	G_MAIN_GRAIN_ORIGINAL = new Konva.Image({
		x: (max - iw)/2,
		y: (max - ih)/2,
		image: imageObj,
		width: iw, 
		height: ih,
	});

	stages[1].getLayers()[0].add(G_MAIN_GRAIN_ORIGINAL);

	OnImageLoaded(G_MAIN_GRAIN_ORIGINAL, circle, stages);
});

var G_MAIN_GRAIN = null;


function OnImageLoaded(image, beam, stages){
	var s3 = stages[2];
	var s3l = s3.getLayers()[0];
	s3l.listening(true);

	// Give yellow box border to indicate interactive
	$(s3.getContainer()).css('border-color','yellow')

	var cc = beam.clone();
	var gr = image.clone();
	gr.draggable(true);
	
	gr.globalCompositeOperation(COMPOSITE_OP);

	s3l.add(cc);
	s3l.add(gr);

	// "pre-zoom" a bit, and start with center position
	scaleOnCenter(s3, gr, 1, 4);

	// keep a global reference
	G_MAIN_GRAIN = gr;

	s3l.draw();

	var updateAvgCircle = function(){
		var s3lcx = stages[2].getLayers()[0].getContext();
		var allPx = s3lcx.getImageData(0, 0, s3lcx.canvas.width, s3lcx.canvas.height);
		var avgPx = get_avg_pixel_rgba(allPx);

		var s4 = stages[3];
		var s4l = s4.getLayers()[0];

		var avgCircle = null;
		if (s4l.getChildren().length <= 0){
			avgCircle = circle.clone();
			s4l.add(avgCircle);
		} else {
			avgCircle = s4l.getChildren()[0];
		}

		var avgColor = "rgba("+ avgPx.join(',') +")";
		avgCircle.stroke(avgColor);
		avgCircle.fill(avgColor);

		s4.getContainer().setAttribute('pixel_value', avgColor);

		s4l.draw();
	};

	gr.on('mouseup', function() {
		doUpdate();
	});

	gr.on('wheel', function(e){
		// modified from https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html 
		var stage = s3;
		var scaleBy = 1.2;

		// stop default scrolling
		e.evt.preventDefault();

		// Do half rate scaling, if shift is pressed
		if (e.evt.shiftKey) {
			scaleBy = 1 +((scaleBy-1) / 2);
		}

		var oldScale = gr.scaleX();
		var pointer = stage.getPointerPosition();

		var mousePointTo = {
			x: (pointer.x - gr.x()) / oldScale,
			y: (pointer.y - gr.y()) / oldScale,
		};

		// how to scale? Zoom in? Or zoom out?
		let direction = e.evt.deltaY > 0 ? -1 : 1;

		var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
		gr.scale({ x: newScale, y: newScale });

		var newPos = {
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		};
		gr.position(newPos);


		doUpdate();
	});

	var s3lcx = s3l.getContext();
	console.log("p:[0, 0]", s3lcx.getImageData(0, 0, 1, 1).data.toString());
	console.log("p:["+(s3lcx.canvas.width/2)+", "+(s3lcx.canvas.height/2)+"]", s3lcx.getImageData(
		s3lcx.canvas.width / 2,
		s3lcx.canvas.height / 2,
		1, 1).data.toString());

	// draw bg image for probe layout only once
	var s5 = stages[4];
	var s5l = s5.getLayers()[0];

	var grc = G_MAIN_GRAIN_ORIGINAL.clone();
	s5l.add(grc);
	s5l.draw();

	var updateProbeLayout = function(){
		// draws probe layout

		// get stage layers
		var s5layers = s5.getLayers();

		// get the over-layer, create if not already added
		var s5lg = null;
		var gridDrawn = false;
		if (s5layers.length < 2) {
			s5lg = new Konva.Layer();
			s5.add(s5lg);
		} else {
			s5lg = s5layers[1];
			gridDrawn = true; // assume we drew it already
		}

		// get probe layer, make a new if not already there
		var s5lb = null;
		if (s5layers.length < 3) {
			s5lb = new Konva.Layer();
			s5.add(s5lb);
		} else {
			s5lb = s5layers[2];
		}

		///////////////////////////////
		// Do drawing work ...

		var tRows = getRowsInput();
		var tCols = getColsInput();

		// get the user scaled gr
		var grs = G_MAIN_GRAIN;
		
		// uncomment to draw grid only once
		gridDrawn = false; s5lg.destroyChildren();

		// draw grid on base/source image
		if (!gridDrawn)
			drawGrid(s5lg, grc, tRows, tCols);
		
		// clear the probe layer
		s5lb.destroyChildren();

		var probe = new Konva.Ellipse({
			radius : {
				x : (cc.width() / grs.scaleX()) / 2, //(cell.width/2) * .8,
				y : (cc.height() / grs.scaleY()) / 2 //(cell.height/2) * .8
			},
			fill: 'rgba(255,0,0,.4)',
			strokeWidth: 1,
			stroke: 'red'
		});
		
		repeatDrawOnGrid(s5lb, grc, probe, tRows, tCols);
	}

	// compute resampled image
	var s6 = stages[5];
	// $(s6.getContainer()).css('border-color', 'lime');
	// prep a canvas and context
	var _imgObj = G_MAIN_GRAIN_ORIGINAL.image();
	var processingStage = createOffscreenStage(_imgObj.naturalWidth, _imgObj.naturalHeight, 2);
	var rImageBase = new Konva.Image({
		x: 0, y: 0, image: _imgObj,
		width: _imgObj.naturalWidth, 
		height: _imgObj.naturalHeight,
	});
	processingStage.getLayers()[0].add(rImageBase);
	rImageBase.cache();



	var s6l = s6.getLayers()[0];
	var s6l2 = new Konva.Layer({listening:false}); s6.add(s6l2);

	var tempFastImg = G_MAIN_GRAIN_ORIGINAL.clone();

	s6.draw();


	var s7 = stages[6];
	$(s7.getContainer()).css('border-color', 'lime');


	G_UpdateResampled = function(internallyCalled){
		var rows = getRowsInput();
		var cols = getColsInput();

		if (internallyCalled && (rows*cols > 64)) {
			console.warn('automatic preview disable for 64+ grid cells.');
			return;
		}

		var grs = G_MAIN_GRAIN; // user-scaled
		var probe = new Konva.Ellipse({
			radius : {
				x : (cc.width() / grs.scaleX()) / 2,
				y : (cc.height() / grs.scaleY()) / 2
			},
			fill: 'white',
			listening: false,
		});

		// probe.globalCompositeOperation(COMPOSITE_OP);
		// probe.globalCompositeOperation("source-over");

		// computeResampled(s6, processingStage, rImageBase, probe, getRowsInput(), getColsInput());
		computeResampledPreview(s6, null, tempFastImg, probe, rows, cols);

		computeResampled(s6, s7, tempFastImg, probe, rows, cols);
	}

	var doUpdate = function(){
		updateAvgCircle();
		updateProbeLayout();
		G_UpdateResampled(true);
	};

	doUpdate();
}