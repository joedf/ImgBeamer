const INPUT_IMAGE = 'src/testimages/grains1b.png';
const COMPOSITE_OP = 'source-in';
// const COMPOSITE_OP = 'destination-in';

const nStages = 6;
var sz = 300;
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

var grains1 = null;

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

	grains1 = new Konva.Image({
		x: (max - iw)/2,
		y: (max - ih)/2,
		image: imageObj,
		width: iw, 
		height: ih,
	});

	// add the shape to the layer
	stages[1].getLayers()[0].add(grains1);

	OnImageLoaded(grains1, circle, stages);
};
imageObj.src = INPUT_IMAGE;


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
		updateAvgCircle();
	});

	gr.on('wheel', function(e){
		// modified from https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html 
		var stage = s3;
		var scaleBy = 1.2;

		// stop default scrolling
		e.evt.preventDefault();

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


		updateAvgCircle();
	});

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
		
	updateAvgCircle();

	// draw probe layout
	var s6 = stages[5];
	var s6l = s6.getLayers()[0];

	var grc = image.clone();
	s6l.add(grc);
	s6l.draw();

	var s6lg = new Konva.Layer();
	s6.add(s6lg);

	var tRows = 4;
	var tCols = 6;
	
	var cell = drawGrid(s6lg, grc, tRows, tCols);
	
	var s6lb = new Konva.Layer();
	s6.add(s6lb);

	var newCircle = new Konva.Circle({
		radius: (Math.min(cell.width, cell.height)/2) * .8,
		fill: 'rgba(255,0,0,.4)',
		strokeWidth: 1,
		stroke: 'red'
	});
	
	repeatDrawOnGrid(s6lb, grc, newCircle, tRows, tCols);
}
