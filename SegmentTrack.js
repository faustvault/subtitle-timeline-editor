(function(Timeline){
	"use strict";
	var Proto;
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function SegmentTrack(tl, cues, id, language){
		var active = true,
			that = this;
		this.tl = tl;
		this.id = id;
		this.language = language;
		this.segments = cues.map(function(cue){
			var seg = (cue instanceof Timeline.Segment)?cue:new Timeline.Segment(tl, cue);
			seg.track = that;
			return seg;
		});
		this.segments.sort(Timeline.Segment.order);
		this.visibleSegments = [];
		this.audioId = null;
		this.locked = false;
		Object.defineProperty(this,'active',{
			get: function(){ return active; },
			set: function(val){
				if(!this.locked){
					val = !!val;
					if(val != active){
						active = val;
						if(!active && tl.selectedSegment && tl.selectedSegment.track === this){
							tl.unselect();
						}else{
							tl.renderTrack(this);
						}
						if(this.audioId){ tl.audio[this.audioId].draw(); }
						tl.updateCurrentSegments();
					}
				}
				return active;
			}
		});
	}
	
	Proto = SegmentTrack.prototype;
	
	Proto.add = function(seg){
		var tl = this.tl;
		
		seg.track = this;
		this.segments.push(seg);
		this.segments.sort(Timeline.Segment.order);
		
		// Save the action
		tl.tracker.addAction(new Timeline.Action("create",{
			id:seg.uid,
			track:this.id,
			initialStart:seg.startTime,
			initialEnd:seg.endTime
		}));
		tl.renderTrack(this);
		if(this.active && seg.startTime < this.tl.view.endTime && seg.endTime > this.tl.view.startTime){
			tl.updateCurrentSegments();
		}
		tl.emit('update');
	};
	
	Proto.getSegment = function(id){
		var i, segs = this.segments,
			len = segs.length;
		for(i=0;i<len;i++){
			if(segs[i].uid === id){ return segs[i]; }
		}
	};
	
	Proto.searchRange = function(low, high){
		//TODO: Higher efficiency binary search
		return this.segments.filter(function(seg){
			return !seg.deleted && seg.startTime < high && seg.endTime > low;
		});
	};

	Proto.render = function(){
		var that = this,
			tl = this.tl,
			top = tl.getTrackTop(this),
			startTime = tl.view.startTime,
			ctx = tl.ctx,
			audio = this.audio,
			selected = null;
		
		ctx.drawImage(tl.trackBg, 0, top, tl.view.width, tl.segmentTrackHeight);
		ctx.save();
		ctx.font = tl.titleFont;
		ctx.textBaseline = 'middle';
		ctx.fillStyle = tl.titleTextColor;
		ctx.fillText(this.id, tl.view.width/100, top+tl.segmentTrackHeight/2);
		ctx.restore();
		this.visibleSegments = this.searchRange(startTime,tl.view.endTime).sort(Timeline.Segment.order);
		this.visibleSegments.forEach(function(seg){
			if(seg.selected){ selected = seg; }
			else{ seg.render(); }
		});
		//save the selected segment for last so it's always on top
		selected && selected.render();
	};
	
	Proto.toVTT = function(){
		return "WEBVTT\n\n"+this.segments.map(function(seg){ return this.toVTT(); }).join('');
	};
	
	Proto.toSRT = function(){
		return this.segments.map(function(seg){ return this.toSRT(); }).join('');
	};
	
	Timeline.SegmentTrack = SegmentTrack;
}(Timeline));