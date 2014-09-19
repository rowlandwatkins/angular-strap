/**
 * angular-strap
 * @version v2.1.0 - 2014-09-05
 * @link http://mgcrea.github.io/angular-strap
 * @author Olivier Louvignes (olivier@mg-crea.com)
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
'use strict';

angular.module('mgcrea.ngStrap.modal', ['mgcrea.ngStrap.helpers.dimensions'])

  .provider('$bsmodal', function() {

    var defaults = this.defaults = {
      animation: 'am-fade',
      backdropAnimation: 'am-fade',
      prefixClass: 'modal',
      prefixEvent: 'modal',
      placement: 'top',
      template: 'modal/modal.tpl.html',
      contentTemplate: false,
      container: false,
      element: null,
      backdrop: true,
      keyboard: true,
      html: false,
      show: true
    };

    this.$get = ["$window", "$rootScope", "$compile", "$q", "$templateCache", "$http", "$animate", "$timeout", "$sce", "dimensions", function($window, $rootScope, $compile, $q, $templateCache, $http, $animate, $timeout, $sce, dimensions) {

      var forEach = angular.forEach;
      var trim = String.prototype.trim;
      var requestAnimationFrame = $window.requestAnimationFrame || $window.setTimeout;
      var bodyElement = angular.element($window.document.body);
      var htmlReplaceRegExp = /ng-bind="/ig;

      function ModalFactory(config) {

        var $bsmodal = {};

        // Common vars
        var options = $bsmodal.$options = angular.extend({}, defaults, config);
        $bsmodal.$promise = fetchTemplate(options.template);
        var scope = $modal.$scope = options.scope && options.scope.$new() || $rootScope.$new();
        if(!options.element && !options.container) {
          options.container = 'body';
        }

        // Support scope as string options
        forEach(['title', 'content'], function(key) {
          if(options[key]) scope[key] = $sce.trustAsHtml(options[key]);
        });

        // Provide scope helpers
        scope.$hide = function() {
          scope.$$postDigest(function() {
            $bsmodal.hide();
          });
        };
        scope.$show = function() {
          scope.$$postDigest(function() {
            $bsmodal.show();
          });
        };
        scope.$toggle = function() {
          scope.$$postDigest(function() {
            $bsmodal.toggle();
          });
        };

        // Support contentTemplate option
        if(options.contentTemplate) {
          $bsmodal.$promise = $bsmodal.$promise.then(function(template) {
            var templateEl = angular.element(template);
            return fetchTemplate(options.contentTemplate)
            .then(function(contentTemplate) {
              var contentEl = findElement('[ng-bind="content"]', templateEl[0]).removeAttr('ng-bind').html(contentTemplate);
              // Drop the default footer as you probably don't want it if you use a custom contentTemplate
              if(!config.template) contentEl.next().remove();
              return templateEl[0].outerHTML;
            });
          });
        }

        // Fetch, compile then initialize modal
        var modalLinker, modalElement;
        var backdropElement = angular.element('<div class="' + options.prefixClass + '-backdrop"/>');
        $bsmodal.$promise.then(function(template) {
          if(angular.isObject(template)) template = template.data;
          if(options.html) template = template.replace(htmlReplaceRegExp, 'ng-bind-html="');
          template = trim.apply(template);
          modalLinker = $compile(template);
          $bsmodal.init();
        });

        $bsmodal.init = function() {

          // Options: show
          if(options.show) {
            scope.$$postDigest(function() {
              $bsmodal.show();
            });
          }

        };

        $bsmodal.destroy = function() {

          // Remove element
          if(modalElement) {
            modalElement.remove();
            modalElement = null;
          }
          if(backdropElement) {
            backdropElement.remove();
            backdropElement = null;
          }

          // Destroy scope
          scope.$destroy();

        };

        $bsmodal.show = function() {

          scope.$emit(options.prefixEvent + '.show.before', $bsmodal);
          var parent;
          if(angular.isElement(options.container)) {
            parent = options.container;
          } else {
            parent = options.container ? findElement(options.container) : null;
          }
          var after = options.container ? null : options.element;

          // Fetch a cloned element linked from template
          modalElement = $bsmodal.$element = modalLinker(scope, function(clonedElement, scope) {});

          // Set the initial positioning.
          modalElement.css({display: 'block'}).addClass(options.placement);

          // Options: animation
          if(options.animation) {
            if(options.backdrop) {
              backdropElement.addClass(options.backdropAnimation);
            }
            modalElement.addClass(options.animation);
          }

          if(options.backdrop) {
            $animate.enter(backdropElement, bodyElement, null, function() {});
          }
          $animate.enter(modalElement, parent, after, function() {
            scope.$emit(options.prefixEvent + '.show', $modal);
          });
          scope.$isShown = true;
          scope.$$phase || (scope.$root && scope.$root.$$phase) || scope.$digest();
          // Focus once the enter-animation has started
          // Weird PhantomJS bug hack
          var el = modalElement[0];
          requestAnimationFrame(function() {
            el.focus();
          });

          bodyElement.addClass(options.prefixClass + '-open');
          if(options.animation) {
            bodyElement.addClass(options.prefixClass + '-with-' + options.animation);
          }

          // Bind events
          if(options.backdrop) {
            modalElement.on('click', hideOnBackdropClick);
            backdropElement.on('click', hideOnBackdropClick);
          }
          if(options.keyboard) {
            modalElement.on('keyup', $modal.$onKeyUp);
          }
        };

        $bsmodal.hide = function() {

          scope.$emit(options.prefixEvent + '.hide.before', $bsmodal);
          $animate.leave(modalElement, function() {
            scope.$emit(options.prefixEvent + '.hide', $bsmodal);
            bodyElement.removeClass(options.prefixClass + '-open');
            if(options.animation) {
              bodyElement.removeClass(options.prefixClass + '-with-' + options.animation);
            }
          });
          if(options.backdrop) {
            $animate.leave(backdropElement, function() {});
          }
          scope.$isShown = false;
          scope.$$phase || (scope.$root && scope.$root.$$phase) || scope.$digest();

          // Unbind events
          if(options.backdrop) {
            modalElement.off('click', hideOnBackdropClick);
            backdropElement.off('click', hideOnBackdropClick);
          }
          if(options.keyboard) {
            modalElement.off('keyup', $bsmodal.$onKeyUp);
          }
        };

        $bsmodal.toggle = function() {

          scope.$isShown ? $bsmodal.hide() : $bsmodal.show();

        };

        $bsmodal.focus = function() {
          modalElement[0].focus();
        };

        // Protected methods

        $bsmodal.$onKeyUp = function(evt) {

          if (evt.which === 27 && scope.$isShown) {
            $bsmodal.hide();
            evt.stopPropagation();
          }

        };

        // Private methods

        function hideOnBackdropClick(evt) {
          if(evt.target !== evt.currentTarget) return;
          options.backdrop === 'static' ? $bsmodal.focus() : $bsmodal.hide();
        }

        return $bsmodal;

      }

      // Helper functions

      function findElement(query, element) {
        return angular.element((element || document).querySelectorAll(query));
      }

      function fetchTemplate(template) {
        return $q.when($templateCache.get(template) || $http.get(template))
        .then(function(res) {
          if(angular.isObject(res)) {
            $templateCache.put(template, res.data);
            return res.data;
          }
          return res;
        });
      }

      return ModalFactory;

    }];

  })

  .directive('bsModal', ["$window", "$sce", "$bsmodal", function($window, $sce, $bsmodal) {

    return {
      restrict: 'EAC',
      scope: true,
      link: function postLink(scope, element, attr, transclusion) {

        // Directive options
        var options = {scope: scope, element: element, show: false};
        angular.forEach(['template', 'contentTemplate', 'placement', 'backdrop', 'keyboard', 'html', 'container', 'animation'], function(key) {
          if(angular.isDefined(attr[key])) options[key] = attr[key];
        });

        // Support scope as data-attrs
        angular.forEach(['title', 'content'], function(key) {
          attr[key] && attr.$observe(key, function(newValue, oldValue) {
            scope[key] = $sce.trustAsHtml(newValue);
          });
        });

        // Support scope as an object
        attr.bsModal && scope.$watch(attr.bsModal, function(newValue, oldValue) {
          if(angular.isObject(newValue)) {
            angular.extend(scope, newValue);
          } else {
            scope.content = newValue;
          }
        }, true);

        // Initialize modal
        var modal = $bsmodal(options);

        // Trigger
        element.on(attr.trigger || 'click', modal.toggle);

        // Garbage collection
        scope.$on('$destroy', function() {
          if (modal) modal.destroy();
          options = null;
          modal = null;
        });

      }
    };

  }]);
