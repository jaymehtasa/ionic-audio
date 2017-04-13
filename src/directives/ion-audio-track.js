angular.module('ionic-audio').directive('ionAudioTrack', ['MediaManager', '$rootScope', 'Player',  ionAudioTrack]);

function ionAudioTrack(MediaManager, $rootScope, Player) {
    return {
        transclude: true,
        template: '<ng-transclude></ng-transclude>',
        restrict: 'E',
        scope: {
            track: '=',
            togglePlayback: '='
        },
        require: 'ionAudioTrack',
        link: link,
        controller: ['$scope', '$element', ionAudioTrackCtrl]
    };

    function link(scope, element, attr, controller) {
        controller.hasOwnProgressBar = element.find('ion-audio-progress-bar').length > 0
    }

    function ionAudioTrackCtrl($scope, $element) {
        var controller = this;

        var checkeTrackDefaulutValue = 0;



        var init = function(newTrack, oldTrack) {
            if (!newTrack || !newTrack.url) return;

            newTrack.progress = 0;
            newTrack.status = 0;
            newTrack.duration = -1;
            if (oldTrack && oldTrack.id !== undefined) newTrack.id = oldTrack.id;

            if (MediaManager) {
                MediaManager.add(newTrack, playbackSuccess, null, statusChange, progressChange);
            }
        };

        var playbackSuccess = function() {
            $scope.track.status = 0;
            $scope.track.progress = 0;
        };
        var statusChange = function(status) {
            $scope.track.status = status;
        };
        var progressChange = function(progress, duration) {
            $scope.track.progress = progress;


            if(Player.feedTrackTime == $scope.track.progress) {
            	checkeTrackDefaulutValue ++;
            	//console.log(checkeTrackDefaulutValue);
            	if(checkeTrackDefaulutValue > 15) {

            		var currentMedia = MediaManager.getCurrentTimePosition();
                    //console.log(currentMedia);
                    if (currentMedia) {
                    	console.log('play');
                        MediaManager.customPlay();
                        checkeTrackDefaulutValue = 0;
                     }


            	}
            }
            Player.feedTrackTime = $scope.track.progress;
            Player.trackingFeedId = Player.feedId;
            //console.log($scope.track.progress);
            //console.log($scope.track.status);
            $scope.track.duration = duration;
            Player.totalTrackDuration = duration;

            //console.log($scope.track.duration);

        };
        var notifyProgressBar = function() {

            $rootScope.$broadcast('ionic-audio:trackChange', $scope.track);
        };

        this.seekTo = function(pos) {
            MediaManager.seekTo(pos);
        };

        this.getTrack = function() {
            return $scope.track;
        };

        this.start = function() {
            if (!$scope.track || !$scope.track.url) return;

            MediaManager.play($scope.track.id);

            // notify global progress bar if detached from track
            if (!controller.hasOwnProgressBar) notifyProgressBar();

            return $scope.track.id;
        };

        var unbindWatcher = $scope.$watch('track', function(newTrack, oldTrack) {
            if (newTrack === undefined) return;
            MediaManager.stop();
            init(newTrack, oldTrack);
        });

        $scope.$on('$destroy', function() {
            unbindWatcher();
            MediaManager.destroy();
            console.log(546);
        });
    }
}