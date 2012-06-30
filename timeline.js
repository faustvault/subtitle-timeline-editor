/**
 * Timeline class
 * By: Joshua Monson
 * Date: October 2011
 *
 * The timeline class renders a Final Cut Pro-like timeline onto the browser window. It was designed with the purpose of creating and editing
 * subtitles but it can be used for other purposes too.
 **/
var Timeline = (function(){
	function Timeline(location, length, viewlength) {
		var canvas = document.createElement('canvas'),
			overlay = document.createElement('canvas'),
			node = document.createElement('div');
		
		this.length = length; // In seconds
		this.view = new timelineView(this);
			this.view.length = viewlength;
			this.view.width = window.innerWidth;
			
		this.events = {};
		this.tracks = [];
		this.audio = [];
		this.trackIndices = {};
		this.kTracks = 0;
		
		this.activeElement = null;
		this.segmentPlaceholder = null;
		this.selectedSegment = null;
		this.selectedTrack = null;
		this.currentSegments = [];
		
		this.slider = new Slider(this);
			this.sliderActive = false;
		
		this.toolbar = null;
		
		this.tracker = new TimelineTracker(this);
		
		this.timeMarkerPos = 0;
		this.direction = $(location).css("direction");
		this.repeatA = null;
		this.repeatB = null;
		this.abRepeatOn = false;
	  
		// Sizing
		this.height = this.keyHeight + this.segmentTrackPadding + this.sliderHeight;
		
		//cursor & tool selection
		this.currentTool = Timeline.SELECT;
		
		// Canvas
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');	
		this.overlay = overlay;
		this.octx = overlay.getContext('2d');
		canvas.addEventListener('mousemove', mouseMove.bind(this), false);
		canvas.addEventListener('mouseup', mouseUp.bind(this), false);
		canvas.addEventListener('mousedown', mouseDown.bind(this), false);
		
		//put stuff on the page
		canvas.height = this.height;
		canvas.width = window.innerWidth;
		overlay.height = this.height;
		overlay.width = window.innerWidth;
		overlay.style.position = "absolute";
		overlay.style.top = 0;
		overlay.style.left = 0;
		overlay.style.pointerEvents = "none";
		window.addEventListener("resize", windowResize.bind(this), false);
		
		node.style.position = "relative";
		node.appendChild(canvas);
		node.appendChild(overlay);
		location.appendChild(node);
	}
	
	Timeline.SELECT = 1;
	Timeline.MOVE = 2;
	Timeline.CREATE = 3;
	Timeline.DELETE = 4;
	Timeline.RESIZE = 5;
	Timeline.REPEAT = 6;

	function windowResize() {
		// Adjust the width
		this.view.width = window.innerWidth;
		this.canvas.width = window.innerWidth;
		this.overlay.width = window.innerWidth;
		
		// Adjust the view slider
		this.slider.updateLength();

		// Re-render the timeline
		this.render();		
	}

	Timeline.prototype.segmentTrackHeight = 50;
	Timeline.prototype.segmentFontSize = "20px";
	Timeline.prototype.segmentFontPadding = 5;
	Timeline.prototype.segmentTrackPadding = 10;
	Timeline.prototype.sliderHeight = 25;
	Timeline.prototype.sliderHandleWidth = 15;
	Timeline.prototype.keyTop = 0;
	Timeline.prototype.keyHeight = 25;
	Timeline.prototype.toolbarHeight = 0;
	Timeline.prototype.keyFontSize = "14px";

		// Coloring
	Timeline.prototype.backgroundColor = "rgba(64, 66, 69, 1)";
		Timeline.prototype.backgroundColorTop = "#3e3f43";
		Timeline.prototype.backgroundColorBottom = "#292a2d";
	Timeline.prototype.trackColor = "rgba(75, 75, 255, 0.1)";
		Timeline.prototype.trackColorTop = "#292a2d";
		Timeline.prototype.trackColorBottom = "#55585c";
	Timeline.prototype.segmentColor = "rgba(98, 129, 194, 0.3)";
		Timeline.prototype.secondarySegmentColor = "rgba(142, 148, 160, 0.3)";
		Timeline.prototype.placeholderColor = "rgba(255, 255, 160, 0.5)";
		Timeline.prototype.highlightedColor = "#134dc8";
	Timeline.prototype.segmentTextColor = "#000";
	Timeline.prototype.keyTextColor = "#fff";
	Timeline.prototype.sliderColor = "#134dc8";
		Timeline.prototype.sliderHandleColor = "#008";
	Timeline.prototype.timeMarkerColor = "rgba(255, 255, 160, 0.5)";
	Timeline.prototype.abRepeatColor = "rgba(255, 0, 0, 0.4)";
		Timeline.prototype.abRepeatColorLight = "rgba(255, 0, 0, 0.25)";
		
	// Images
	Timeline.prototype.loadImages = function(srcs) {
		var imgName, img;
		for(imgName in srcs){
			img = new Image;
			img.src = srcs[imgName];
			this[imgName] = img;
		}
	};
	
	Timeline.prototype.loadImages.call(Timeline.prototype,{
		// normal images
		segmentLeft: "./images/event_left.png",
		segmentRight: "./images/event_right.png",
		segmentMid: "./images/event_mid.png",
		// selected images
		segmentLeftSel: "./images/event_left_sel.png",
		segmentRightSel: "./images/event_right_sel.png",
		segmentMidSel: "./images/event_mid_sel.png",
		// dark images
		segmentLeftDark: "./images/event_left_dark.png",
		segmentRightDark: "./images/event_right_dark.png",
		segmentMidDark: "./images/event_mid_dark.png",
		// slider images
		sliderLeft: "./images/slider_left.png",
		sliderRight: "./images/slider_right.png",
		sliderMid: "./images/slider_mid.png",
		// track images
		trackBg: "./images/track_bg.png"
	});	
	
	Object.defineProperties(Timeline.prototype,{
		currentTime: {
			set: function(val){
				this.updateTimeMarker(val);
				return this.timeMarkerPos;
			},
			get: function(){return this.timeMarkerPos;}
		}
	});
	
	/* Event Triggers */

	Timeline.prototype.emit = function(evt, data){
		var that = this, fns = this.events[evt];
		fns && fns.forEach(function(cb){ cb.call(that,data); });
	};

	Timeline.prototype.on = function(name, cb){
		if(name in this.events){ this.events[name].push(cb); }
		else{ this.events[name] = [cb]; }
	};

	Timeline.prototype.updateCursor = function(pos) {
		if(typeof pos !== 'object')
			return;
		var i,j,track,seg,shape,cursor;
		
		// Check the slider
		if(this.slider.containsPoint({x: this.slider.x, y: pos.y})) {
			cursor = "url(\"./images/cursors/cursor.png\"), auto";
		}else if(pos.y < this.keyHeight+this.segmentTrackPadding) { // Check the key
			cursor = "url(\"./images/cursors/skip.png\") 0 5, auto";
		}else
		select_cursor: {
			switch(this.currentTool){
				case Timeline.CREATE:
					cursor = "url(\"./images/cursors/add.png\"), auto";
					break select_cursor;
				case Timeline.REPEAT:
					cursor = this.abRepeatOn?"url(\"./images/cursors/cursor.png\"), auto":
							this.repeatA == null?"url(\"./images/cursors/repeat-a.png\"), auto":
							"url(\"./images/cursors/repeat-b.png\"), auto";
					break select_cursor;
			}
			// Are we on a subtitle
			for(i=0;track=this.tracks[i];i++) {
				if(!(track instanceof segmentTrack)){ continue; }
				//traverse backwards so you get the ones on top
				for(j=track.visibleSegments.length-1;seg=track.visibleSegments[j];j--) {
					if(!seg.containsPoint(pos)){ continue; }
					shape = seg.getShape();
					switch(this.currentTool){
						case Timeline.SELECT:
							cursor = "url(\"./images/cursors/cursor-highlight.png\"), auto";
							break select_cursor;
						case Timeline.MOVE:
							cursor = "url(\"./images/cursors/move.png\") 15 15, move";
							break select_cursor;
						case Timeline.DELETE:
							cursor = "url(\"./images/cursors/delete.png\"), pointer";
							break select_cursor;
						case Timeline.RESIZE:
							cursor = (pos.x < shape.x + shape.width/2)?
									"url(\"./images/cursors/resize-left.png\") 3 15, w-resize":
									"url(\"./images/cursors/resize-right.png\") 29 15, e-resize";
							break select_cursor;
					}
				}
			}
			//default
			cursor = "url(\"./images/cursors/cursor.png\"), auto";
		}
		
		this.ctx.canvas.style.cursor = cursor;
	};
		
	/**
	 * Helper Functions
	 * 
	 * These functions deal with manipulating the data
	 * 
	 * Author: Joshua Monson
	 **/
	 
	Timeline.prototype.select = function(seg){
		if(this.selectedSegment != null){
			this.selectedSegment.selected = false;
		}
		if(this.selectedTrack && seg.track != this.selectedTrack.id){
			this.selectedTrack.active = false;
			this.selectedTrack = this.tracks[seg.track];
			this.selectedTrack.active = true;
			this.updateCurrentSegments();
		}else{
			this.selectedTrack = this.tracks[seg.track];
			this.selectedTrack.active = true;
			Array.prototype.push.apply(this.currentSegments,this.selectedTrack.searchRange(this.timeMarkerPos,this.timeMarkerPos));
			this.emit('segments',{
				valid:this.currentSegments,
				invalid:[]
			});
		}
		this.selectedSegment = seg;
		seg.selected = true;
		this.render();
		this.emit('select', seg);
	};

	Timeline.prototype.unselect = function(){
		this.selectedSegment.selected = false;
		this.selectedSegment = null;
		this.render();
		this.emit('unselect');
	};

	Timeline.prototype.setText = function(text) {
		if(this.selectedSegment != null) {
			this.selectedSegment.text = text;
		}
	};

	// Helper functions

	Timeline.prototype.getTrackTop = function(track) {
		if(track in this.trackIndices){ track = this.trackIndices[track]; }
		return this.keyHeight + this.segmentTrackPadding + (track * (this.segmentTrackHeight + this.segmentTrackPadding));
	};

	Timeline.prototype.getTrack = function(pos) {
		var i, top, bottom;
		for(var i=this.tracks.length-1; i >= 0; i--) {
			top = this.getTrackTop(i);
			bottom = top + this.segmentTrackHeight;
			if(pos.y >= top & pos.y <= bottom)
				return i;
		}
		return -1;
	};

	// Creation functions
	Timeline.prototype.createSegment = function(pos, track) {
		// TODO: Don't create if the track is locked/disabled
		this.segmentPlaceholder = new SegmentPlaceholder(this, pos.x, track);
	};

	/**
	 * Event Listeners and Callbacks
	 *
	 * These listeners include mouseMove, mouseUp, and mouseDown.
	 * They check the mouse location and active elements and call their mouse listener function.
	 * 
	 * Author: Joshua Monson
	 **/
	function mouseMove(ev) {
		var canvasTop = $(this.ctx.canvas).offset().top,
			pos = {x: ev.pageX, y: ev.pageY-canvasTop};

		this.updateCursor(pos);

		if(this.currentTool == Timeline.REPEAT
			&& this.repeatA != null && !this.abRepeatOn){
			this.updateB(pos);
		}else if(this.segmentPlaceholder != null){
			this.segmentPlaceholder.mouseMove(pos);
		}else if(this.sliderActive){
			this.slider.mouseMove(pos);
		}else if(this.activeElement != null){
			this.activeElement.mouseMove(pos);
		}
	}

	function mouseUp(ev) {
		var canvasTop = $(this.ctx.canvas).offset().top,
			pos = {x: ev.pageX, y: ev.pageY-canvasTop},
			id, track;

		if(this.currentTool == Timeline.REPEAT // Are we creating a repeat?
			&& !this.abRepeatOn && this.repeatA != this.repeatB) {
			this.setB(pos);
			this.updateCursor(pos);
		}else if(this.segmentPlaceholder != null) { // Are we creating a new segment?
			this.segmentPlaceholder.mouseUp(pos);
			this.segmentPlaceholder = null;
		}else if(this.sliderActive) {
			this.slider.mouseUp(pos);
			this.sliderActive = false;
			if(this.selectedTrack && this.selectedTrack.audio > -1){
				this.audio[this.selectedTrack.audio].redraw();
			}
		}else if(this.activeElement != null) {
			this.activeElement.mouseUp(pos);
			this.activeElement = null;
		}else if(this.currentTool == Timeline.SELECT){ //deactivate a track
			id = this.getTrack(pos);
			if(this.tracks[id] === this.selectedTrack && !this.selectedSegment){
				this.selectedTrack.active = false;
				this.selectedTrack = null;
				this.renderTrack(id);
				this.updateCurrentSegments();
			}
		}
	}

	function mouseDown(ev) {
		var canvasTop = $(this.ctx.canvas).offset().top,
			pos = {x: ev.pageX, y: ev.pageY-canvasTop},
			track,id,seg,i,j;

		if(this.slider.containsPoint(pos)) { // Check the slider
			this.slider.mouseDown(pos);
			this.sliderActive = true;
		}else if(pos.y < this.keyHeight+this.segmentTrackPadding) { // Check the key
			i = this.pixelToTime(pos.x);
			this.updateTimeMarker(i);
			this.emit('jump',i);
			this.emit('timeupdate',i);
		}else switch(this.currentTool){
			case Timeline.CREATE: // Are we creating a segment?
				id = this.getTrack(pos);
				if(id > -1) { this.createSegment(pos, id); }
				break;
			case Timeline.REPEAT: // Are we creating a repeat?
				if(this.abRepeatOn){ this.clearRepeat(); }
				else if(this.repeatA == null){ this.setA(pos); }
				else{ this.setB(pos); }
				this.updateCursor(pos);
		}
		
		// Check all the segments
		for(i=0;track=this.tracks[i];i++) {
			if(!(track instanceof segmentTrack)){ continue; }
			//search backwards 'cause later segments are on top
			for(j=track.visibleSegments.length-1;seg = track.visibleSegments[j];j--) {
				if(!seg.containsPoint(pos)) { continue; }
				this.activeElement = seg;
				seg.mouseDown(pos);
				return;
			}
		}
	}

	Timeline.prototype.addSegmentTrack = function(cues, id, language, karaoke) {
		var track;
		if(id in this.tracks){ throw new Error("Track with that id already loaded."); }
		if(cues instanceof segmentTrack){
			track = cues;
			id = track.id;
			karaoke = track.karaoke;
		}else{
			track = new segmentTrack(this, cues, id, language, karaoke);
		}
		this.tracks[id] = track;
		this.trackIndices[id] = this.tracks.length;
		this.tracks.push(track);
		if(karaoke == true) { this.kTracks++; }

		// Adjust the height
		this.height += this.segmentTrackHeight + this.segmentTrackPadding;
		this.canvas.height = this.height;
		this.overlay.height = this.height;	
	};

	Timeline.prototype.addAudioTrack = function(wave, trackId) {
		var that = this,
			i = this.audio.length,
			track = this.tracks[trackId];
		if(!track){ return; }
		track.audio = i;
		this.audio.push(wave);
		wave.on('redraw',function(){
			var ctx, top, track = that.selectedTrack;
			if(track && track.audio === i){
				top = that.getTrackTop(track.id);
				ctx = that.octx;
				ctx.clearRect(0, top, that.view.width, that.segmentTrackHeight);
				ctx.save();
				ctx.globalAlpha = .5;
				ctx.drawImage(wave.buffer, 0, top);		
				ctx.restore();
			}
		});
		wave.redraw();
	};
	
	Timeline.prototype.removeSegmentTrack = function(id) {
		var i,track,loc = this.tracks.indexOf(id);
		if(loc >= 0){
			this.tracks.splice(loc, 1);
			if(this.tracks[loc].karaoke){ this.kTracks--; }
			delete this.tracks[id];
			delete this.trackIndices[id];
		}
		for(i=0;track=this.tracks[i];i++){
			this.trackIndices[track.id] = i;		
		}
		
		// Adjust the height
		this.height -= this.segmentTrackHeight + this.segmentTrackPadding;
		this.canvas.height = this.height;
		this.overlay.height = this.height;
	};
	
	// Drawing functions
	Timeline.prototype.renderKey = function() {
		var ctx = this.ctx,
			view = this.view,
			zoom = view.zoom,
			power, d=0,
			hours, mins, secs, pixels,
			start, end, position, increment;
		
		ctx.save();
		ctx.font         = 'italic '+this.keyFontSize+' sans-serif';
		ctx.textBaseline = 'top';
		ctx.fillStyle    = this.keyTextColor;
		ctx.strokeStyle    = this.keyTextColor;

		// Find the smallest increment in powers of 2 that gives enough room for 1-second precision
		power = Math.ceil(Math.log(ctx.measureText(" 0:00:00").width*zoom)/0.6931471805599453);
		increment = Math.pow(2,power);
		pixels = increment/zoom;

		//if we're below 1-second precision, adjust the increment to provide extra room
		if(power < 0){
			d = power<-2?3:-power;
			if(pixels < ctx.measureText(" 0:00:0"+(0).toFixed(d)).width){
				increment*=2;
				pixels*=2;
				d--;
			}
		}
		
		start = view.startTime;
		start -= start%increment;
		end = view.endTime;
		
		for (position = this.timeToPixel(start); start < end; start += increment, position += pixels) {

			// Draw the tick
			ctx.beginPath();
			ctx.moveTo(position, this.keyTop);
			ctx.lineTo(position, this.keyTop + this.keyHeight);
			ctx.stroke();

			// Now put the number on
			secs = start % 60;
			mins = Math.floor(start / 60);
			hours = Math.floor(mins / 60);
			mins %= 60;
			
			ctx.fillText(
				hours + (mins<10?":0":":") + mins + (secs<10?":0":":") + secs.toFixed(d),
				(this.direction == "ltr") ? position + 2 : position - 2,
				this.keyTop + 2
			);
		}
		ctx.restore();
	};

	Timeline.prototype.renderBackground = function() {
		var ctx = this.ctx,
			grd = ctx.createLinearGradient(0,0,0,this.height);

		// Draw the backround color
		grd.addColorStop(0,this.backgroundColorBottom);
		grd.addColorStop(0.5,this.backgroundColorTop);
		grd.addColorStop(1,this.backgroundColorBottom);
		ctx.save();
		ctx.fillStyle = grd;
		ctx.globalCompositeOperation = "source-over";
		ctx.fillRect(0, 0, this.view.width, this.height);
		ctx.restore();
	};

	Timeline.prototype.renderTimeMarker = function() {
		var ctx, x = this.timeToPixel(this.timeMarkerPos)-1;
		if(x < 0 || x > this.view.width){ return; }
		ctx = this.ctx
		ctx.save();
		ctx.fillStyle = this.timeMarkerColor;
		ctx.fillRect(x, 0, 2, this.height);
		ctx.restore();
	};
		
	Timeline.prototype.renderABRepeat = function() {
		if(this.repeatA != null) {
			var left = this.timeToPixel(this.repeatA),
				right = this.timeToPixel(this.repeatB),
				ctx = this.ctx;
			ctx.save();
			ctx.fillStyle = this.abRepeatOn?this.abRepeatColor:this.abRepeatColorLight;
			ctx.fillRect(left, 0, right-left, this.height);
			ctx.restore();
		}
	};

	Timeline.prototype.render = function() {
		var startTime = this.view.startTime,
			length = this.view.length;
		this.renderBackground();
		this.tracks.forEach(function(track){ track.render(); });
		if(this.selectedTrack && this.selectedTrack.audio > -1){
			this.audio[this.selectedTrack.audio].shift(startTime, length);
		}
		this.renderKey();
		this.renderTimeMarker();
		this.renderABRepeat();
		this.slider.render();
	};
	
	Timeline.prototype.renderTrack = function(id) {
		var ctx, x = this.timeToPixel(this.timeMarkerPos)-1;
		
		this.tracks[id].render();
		
		
		//redo the peice of the timeMarker that we drew over
		if(x < 0 || x > this.view.width){ return; }
		ctx = this.ctx;
		ctx.save();
		ctx.fillStyle = this.timeMarkerColor;
		ctx.fillRect(x, this.getTrackTop(id), 2, this.segmentTrackHeight);
		ctx.restore();
	};

	//Time functions
	Object.defineProperties(Timeline.prototype,{
		sliderOffset: {
			get: function() {
				return this.length * this.slider.x / this.view.width;
			}, enumerable: true
		}
	});
	Timeline.prototype.pixelToTime = function(pixel) {
		return pixel * this.view.zoom + this.sliderOffset;
	};
	Timeline.prototype.timeToPixel = function(time) {
		return Math.round((time-this.sliderOffset) / this.view.zoom);
	};
	
	Timeline.prototype.updateTimeMarker = function(time) {
		
		if(time == this.timeMarkerPos){ return; }
		
		// Check the repeat
		if(this.abRepeatOn && time > this.repeatB) {
			time = this.repeatA;
			this.emit('jump',this.repeatA);
		}

		this.timeMarkerPos = time;
		this.updateCurrentSegments();
		this.emit('timeupdate', time);
		
		/*if(this.timeMarkerPos > this.pixelToTime(this.view.width))
			this.moveTimeMarkerIntoView(time);
		else*/
			this.render();
	};

	Timeline.prototype.updateCurrentSegments = function(){
		var that = this,
			time = this.timeMarkerPos,
			oldsegs = this.currentSegments,
			cursegs = [];
		this.tracks.forEach(function(track){
			if(track.active){Array.prototype.push.apply(cursegs,track.searchRange(time,time));}
		});
		this.currentSegments = cursegs;
		this.emit('segments',{
			valid:cursegs,
			invalid:oldsegs.filter(function(seg){
				return !that.tracks[seg.track].active || seg.startTime > time || seg.endTime < time;
			})
		});
	};

	Timeline.prototype.setA = function(pos) {
		this.repeatA = this.pixelToTime(pos.x);
		this.repeatB = this.pixelToTime(pos.x);
	};

	Timeline.prototype.setB = function(pos) {
		this.repeatB = this.pixelToTime(pos.x);
		if(this.repeatB < this.repeatA) {
			var t = this.repeatB;
			this.repeatB = this.repeatA;
			this.repeatA = t;
		}
		this.abRepeatOn = true;
		this.render();
		this.emit('abRepeatEnabled');
	};

	Timeline.prototype.updateB = function(pos) {
		this.repeatB = this.pixelToTime(pos.x);
		this.render();
	};

	Timeline.prototype.clearRepeat = function() {
		this.repeatA = null;
		this.repeatB = null;
		this.abRepeatOn = false;
		this.render();
	};

	Timeline.prototype.moveTimeMarkerIntoView = function(time) {
		var leftTime = this.pixelToTime(0);
		var rightTime = this.pixelToTime(this.view.width);
		
		if(time < leftTime || time > rightTime) {
			// Move the view
			var p = time/this.length;
			var w = Math.round((this.view.width - this.slider.width)*p);
			//alert(w);
			this.slider.x = w;
			this.render();
		}
	};
	
	return Timeline;
}());