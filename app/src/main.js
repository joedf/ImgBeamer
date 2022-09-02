const INPUT_IMAGE = 'src/testimages/grains1b.png';
const COMPOSITE_OP = 'source-in';
// const COMPOSITE_OP = 'destination-in';
const G_IMAGE_ROWS = 4;
const G_IMAGE_COLUMNS = 6;

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
	fill: 'cyan',

	/*
	fillRadialGradientStartRadius: 0,
	fillRadialGradientEndRadius: 70,
	fillRadialGradientStartPoint: { x: 0, y: 0 },
	fillRadialGradientEndPoint: { x: 0, y: 0 },
	fillRadialGradientColorStops: [0, 'cyan', 1, 'black'],
	*/

	// stroke: 'red',
	strokeWidth: 0,
});

var s1l = stages[0].getLayers()[0];

// add the shape to the layer
s1l.add(circle);

// draw the image
s1l.draw();

/////////////////////

var G_MAIN_GRAIN_ORIGINAL = null;

var imageObj = new Image();
imageObj.onload = function () {
	
	var max = sz;

	console.log("img natural size:", imageObj.naturalWidth, imageObj.naturalHeight);

	var img_width = imageObj.naturalWidth;
	var img_height = imageObj.naturalHeight;

	// var ratio = (img_width > img_height ? (img_height / max) : (img_width / max)) // fill
	var ratio = (img_width > img_height ? (img_width / max) : (img_height / max)) // fit

	var iw = img_width/ratio;
	var ih = img_height/ratio;

	G_MAIN_GRAIN_ORIGINAL = new Konva.Image({
		x: (max - iw)/2,
		y: (max - ih)/2,
		image: imageObj,
		width: iw, 
		height: ih,
	});

	// add the shape to the layer
	stages[1].getLayers()[0].add(G_MAIN_GRAIN_ORIGINAL);

	OnImageLoaded(G_MAIN_GRAIN_ORIGINAL, circle, stages);
};
imageObj.src = INPUT_IMAGE;

var G_MAIN_GRAIN = null;


function OnImageLoaded(image, beam, stages){
	var s3 = stages[2];
	var s3l = s3.getLayers()[0];

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
	
		var s5l = stages[4].getLayers()[0];
	
		var avgCircle = null;
		if (s5l.getChildren().length <= 0){
			avgCircle = circle.clone();
			s5l.add(avgCircle);
		} else {
			avgCircle = s5l.getChildren()[0];
		}
	
		var avgColor = "rgba("+ avgPx.join(',') +")";
		avgCircle.stroke(avgColor);
		avgCircle.fill(avgColor);
	
		s5l.draw();
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

	// a test on composition operation on stage 4
	// hide for now
	$(stages[3].getContainer()).hide();
	var final = s3l.toImage({pixelRatio: devicePixelRatio}).then(function(cnvComposite){
		var s4l = stages[3].getLayers()[0];
		
		var kcc = new Konva.Image({
			x: 0,
			y: 0,
			image: cnvComposite,
			width: sz,
			height: sz,
		});
		
		s4l.add(kcc);
	});

	var s3lcx = s3l.getContext();
	console.log("p:[0, 0]", s3lcx.getImageData(0, 0, 1, 1).data.toString());
	console.log("p:["+(s3lcx.canvas.width/2)+", "+(s3lcx.canvas.height/2)+"]", s3lcx.getImageData(
		s3lcx.canvas.width / 2,
		s3lcx.canvas.height / 2,
		1, 1).data.toString());

	// draw bg image for probe layout only once
	var s6 = stages[5];
	var s6l = s6.getLayers()[0];

	var grc = G_MAIN_GRAIN_ORIGINAL.clone();
	s6l.add(grc);
	s6l.draw();

	var updateProbeLayout = function(){
		// draws probe layout

		// get stage layers
		var s6layers = s6.getLayers();

		// get the over-layer, create if not already added
		var s6lg = null;
		var gridDrawn = false;
		if (s6layers.length < 2) {
			s6lg = new Konva.Layer();
			s6.add(s6lg);
		} else {
			s6lg = s6layers[1];
			gridDrawn = true; // assume we drew it already
		}

		// get probe layer, make a new if not already there
		var s6lb = null;
		if (s6layers.length < 3) {
			s6lb = new Konva.Layer();
			s6.add(s6lb);
		} else {
			s6lb = s6layers[2];
		}

		///////////////////////////////
		// Do drawing work ...

		var tRows = G_IMAGE_ROWS;
		var tCols = G_IMAGE_COLUMNS;

		// get the user scaled gr
		var grs = G_MAIN_GRAIN;
		
		// draw grid on base/source image
		if (!gridDrawn)
			drawGrid(s6lg, grc, tRows, tCols);
		
		// clear the probe layer
		s6lb.destroyChildren();

		var probe = new Konva.Ellipse({
			radius : {
				x : (cc.width() / grs.scaleX()) / 2, //(cell.width/2) * .8,
				y : (cc.height() / grs.scaleY()) / 2 //(cell.height/2) * .8
			},
			fill: 'rgba(255,0,0,.4)',
			strokeWidth: 1,
			stroke: 'red'
		});
		
		repeatDrawOnGrid(s6lb, grc, probe, tRows, tCols);
	}

	// compute resampled image
	var s7 = stages[6];
	var rImageBase = G_MAIN_GRAIN_ORIGINAL.clone();
	$(s7.getContainer()).css('border-color', 'lime');

	var updateResampled = function(){
		var grs = G_MAIN_GRAIN; // user-scaled
		var probe = new Konva.Ellipse({
			radius : {
				x : (cc.width() / grs.scaleX()) / 2,
				y : (cc.height() / grs.scaleY()) / 2
			},
			fill: 'white'
		});

		computeResampled(s7, rImageBase, probe, G_IMAGE_ROWS, G_IMAGE_COLUMNS);
	}

	var doUpdate = function(){
		updateAvgCircle();
		updateProbeLayout();
		updateResampled();
	};

	doUpdate();
}
