/**
 * angular-strap
 * @version v2.1.0 - 2014-09-05
 * @link http://mgcrea.github.io/angular-strap
 * @author Olivier Louvignes (olivier@mg-crea.com)
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
'use strict';

angular.module('mgcrea.ngStrap.tooltip', ['mgcrea.ngStrap.helpers.dimensions'])

  .provider('$bstooltip', function() {

    var defaults = this.defaults = {
      animation: 'am-fade',
      customClass: '',
      prefixClass: 'tooltip',
      prefixEvent: 'tooltip',
      container: false,
      target: false,
      placement: 'top',
      template: 'tooltip/tooltip.tpl.html',
      contentTemplate: false,
      trigger: 'hover focus',
      keyboard: false,
      html: false,
      show: false,
      title: '',
      type: '',
      delay: 0
    };

    this.$get = ["$window", "$rootScope", "$compile", "$q", "$templateCache", "$http", "$animate", "dimensions", "$$rAF", function($window, $rootScope, $compile, $q, $templateCache, $http, $animate, dimensions, $$rAF) {

      var trim = String.prototype.trim;
      var isTouch = 'createTouch' in $window.document;
      var htmlReplaceRegExp = /ng-bind="/ig;

      function TooltipFactory(element, config) {

        var $bstooltip = {};

        // Common vars
        var nodeName = element[0].nodeName.toLowerCase();
        var options = $bstooltip.$options = angular.extend({}, defaults, config);
        $bstooltip.$promise = fetchTemplate(options.template);
        var scope = $bstooltip.$scope = options.scope && options.scope.$new() || $rootScope.$new();
        if(options.delay && angular.isString(options.delay)) {
          options.delay = parseFloat(options.delay);
        }

        // Support scope as string options
        if(options.title) {
          $bstooltip.$scope.title = options.title;
        }

        // Provide scope helpers
        scope.$hide = function() {
          scope.$$postDigest(function() {
            $bstooltip.hide();
          });
        };
        scope.$show = function() {
          scope.$$postDigest(function() {
            $bstooltip.show();
          });
        };
        scope.$toggle = function() {
          scope.$$postDigest(function() {
            $bstooltip.toggle();
          });
        };
        $bstooltip.$isShown = scope.$isShown = false;

        // Private vars
        var timeout, hoverState;

        // Support contentTemplate option
        if(options.contentTemplate) {
          $bstooltip.$promise = $bstooltip.$promise.then(function(template) {
            var templateEl = angular.element(template);
            return fetchTemplate(options.contentTemplate)
            .then(function(contentTemplate) {
              var contentEl = findElement('[ng-bind="content"]', templateEl[0]);
              if(!contentEl.length) contentEl = findElement('[ng-bind="title"]', templateEl[0]);
              contentEl.removeAttr('ng-bind').html(contentTemplate);
              return templateEl[0].outerHTML;
            });
          });
        }

        // Fetch, compile then initialize tooltip
        var tipLinker, tipElement, tipTemplate, tipContainer;
        $bstooltip.$promise.then(function(template) {
          if(angular.isObject(template)) template = template.data;
          if(options.html) template = template.replace(htmlReplaceRegExp, 'ng-bind-html="');
          template = trim.apply(template);
          tipTemplate = template;
          tipLinker = $compile(template);
          $bstooltip.init();
        });

        $bstooltip.init = function() {

          // Options: delay
          if (options.delay && angular.isNumber(options.delay)) {
            options.delay = {
              show: options.delay,
              hide: options.delay
            };
          }

          // Replace trigger on touch devices ?
          // if(isTouch && options.trigger === defaults.trigger) {
          //   options.trigger.replace(/hover/g, 'click');
          // }

          // Options : container
          if(options.container === 'self') {
            tipContainer = element;
          } else if(angular.isElement(options.container)) {
            tipContainer = options.container;
          } else if(options.container) {
            tipContainer = findElement(options.container);
          }

          // Options: trigger
          var triggers = options.trigger.split(' ');
          angular.forEach(triggers, function(trigger) {
            if(trigger === 'click') {
              element.on('click', $bstooltip.toggle);
            } else if(trigger !== 'manual') {
              element.on(trigger === 'hover' ? 'mouseenter' : 'focus', $bstooltip.enter);
              element.on(trigger === 'hover' ? 'mouseleave' : 'blur', $bstooltip.leave);
              nodeName === 'button' && trigger !== 'hover' && element.on(isTouch ? 'touchstart' : 'mousedown', $bstooltip.$onFocusElementMouseDown);
            }
          });

          // Options: target
          if(options.target) {
            options.target = angular.isElement(options.target) ? options.target : findElement(options.target);
          }

          // Options: show
          if(options.show) {
            scope.$$postDigest(function() {
              options.trigger === 'focus' ? element[0].focus() : $bstooltip.show();
            });
          }

        };

        $bstooltip.destroy = function() {

          // Unbind events
          var triggers = options.trigger.split(' ');
          for (var i = triggers.length; i--;) {
            var trigger = triggers[i];
            if(trigger === 'click') {
              element.off('click', $bstooltip.toggle);
            } else if(trigger !== 'manual') {
              element.off(trigger === 'hover' ? 'mouseenter' : 'focus', $bstooltip.enter);
              element.off(trigger === 'hover' ? 'mouseleave' : 'blur', $bstooltip.leave);
              nodeName === 'button' && trigger !== 'hover' && element.off(isTouch ? 'touchstart' : 'mousedown', $bstooltip.$onFocusElementMouseDown);
            }
          }

          // Remove element
          if(tipElement) {
            tipElement.remove();
            tipElement = null;
          }

          // Cancel pending callbacks
          clearTimeout(timeout);

          // Destroy scope
          scope.$destroy();

        };

        $bstooltip.enter = function() {

          clearTimeout(timeout);
          hoverState = 'in';
          if (!options.delay || !options.delay.show) {
            return $bstooltip.show();
          }

          timeout = setTimeout(function() {
            if (hoverState ==='in') $bstooltip.show();
          }, options.delay.show);

        };

        $bstooltip.show = function() {

          scope.$emit(options.prefixEvent + '.show.before', $bstooltip);
          var parent = options.container ? tipContainer : null;
          var after = options.container ? null : element;

          // Hide any existing tipElement
          if(tipElement) tipElement.remove();
          // Fetch a cloned element linked from template
          tipElement = $bstooltip.$element = tipLinker(scope, function(clonedElement, scope) {});

          // Set the initial positioning.  Make the tooltip invisible
          // so IE doesn't try to focus on it off screen.
          tipElement.css({top: '-9999px', left: '-9999px', display: 'block', visibility: 'hidden'}).addClass(options.placement);

          // Options: animation
          if(options.animation) tipElement.addClass(options.animation);
          // Options: type
          if(options.type) tipElement.addClass(options.prefixClass + '-' + options.type);
          // Options: custom classes
          if(options.customClass) tipElement.addClass(options.customClass);

          $animate.enter(tipElement, parent, after, function() {
            scope.$emit(options.prefixEvent + '.show', $bstooltip);
          });
          $bstooltip.$isShown = scope.$isShown = true;
          scope.$$phase || (scope.$root && scope.$root.$$phase) || scope.$digest();
          $$rAF(function () {
            $bstooltip.$applyPlacement();

            // Once placed, make the tooltip visible
            tipElement.css({visibility: 'visible'});
          }); // var a = bodyEl.offsetWidth + 1; ?

          // Bind events
          if(options.keyboard) {
            if(options.trigger !== 'focus') {
              $bstooltip.focus();
              tipElement.on('keyup', $bstooltip.$onKeyUp);
            } else {
              element.on('keyup', $bstooltip.$onFocusKeyUp);
            }
          }

        };

        $bstooltip.leave = function() {

          clearTimeout(timeout);
          hoverState = 'out';
          if (!options.delay || !options.delay.hide) {
            return $bstooltip.hide();
          }
          timeout = setTimeout(function () {
            if (hoverState === 'out') {
              $bstooltip.hide();
            }
          }, options.delay.hide);

        };

        $bstooltip.hide = function(blur) {

          if(!$bstooltip.$isShown) return;
          scope.$emit(options.prefixEvent + '.hide.before', $bstooltip);

          $animate.leave(tipElement, function() {
            scope.$emit(options.prefixEvent + '.hide', $bstooltip);

            // Allow to blur the input when hidden, like when pressing enter key
            if(blur && options.trigger === 'focus') {
              return element[0].blur();
            }
          });

          $bstooltip.$isShown = scope.$isShown = false;
          scope.$$phase || (scope.$root && scope.$root.$$phase) || scope.$digest();

          // Unbind events
          if(options.keyboard && tipElement !== null) {
            tipElement.off('keyup', $bstooltip.$onKeyUp);
          }

        };

        $bstooltip.toggle = function() {
          $bstooltip.$isShown ? $bstooltip.leave() : $bstooltip.enter();
        };

        $bstooltip.focus = function() {
          tipElement[0].focus();
        };

        // Protected methods

        $bstooltip.$applyPlacement = function() {
          if(!tipElement) return;

          // Get the position of the tooltip element.
          var elementPosition = getPosition();

          // Get the height and width of the tooltip so we can center it.
          var tipWidth = tipElement.prop('offsetWidth'),
              tipHeight = tipElement.prop('offsetHeight');

          // Get the tooltip's top and left coordinates to center it with this directive.
          var tipPosition = getCalculatedOffset(options.placement, elementPosition, tipWidth, tipHeight);

          // Now set the calculated positioning.
          tipPosition.top += 'px';
          tipPosition.left += 'px';
          tipElement.css(tipPosition);

        };

        $bstooltip.$onKeyUp = function(evt) {
          if (evt.which === 27 && $bstooltip.$isShown) {
            $bstooltip.hide();
            evt.stopPropagation();
          }
        };

        $bstooltip.$onFocusKeyUp = function(evt) {
          if (evt.which === 27) {
            element[0].blur();
            evt.stopPropagation();
          }
        };

        $bstooltip.$onFocusElementMouseDown = function(evt) {
          evt.preventDefault();
          evt.stopPropagation();
          // Some browsers do not auto-focus buttons (eg. Safari)
          $bstooltip.$isShown ? element[0].blur() : element[0].focus();
        };

        // Private methods

        function getPosition() {
          if(options.container === 'body') {
            return dimensions.offset(options.target[0] || element[0]);
          } else {
            return dimensions.position(options.target[0] || element[0]);
          }
        }

        function getCalculatedOffset(placement, position, actualWidth, actualHeight) {
          var offset;
          var split = placement.split('-');

          switch (split[0]) {
          case 'right':
            offset = {
              top: position.top + position.height / 2 - actualHeight / 2,
              left: position.left + position.width
            };
            break;
          case 'bottom':
            offset = {
              top: position.top + position.height,
              left: position.left + position.width / 2 - actualWidth / 2
            };
            break;
          case 'left':
            offset = {
              top: position.top + position.height / 2 - actualHeight / 2,
              left: position.left - actualWidth
            };
            break;
          default:
            offset = {
              top: position.top - actualHeight,
              left: position.left + position.width / 2 - actualWidth / 2
            };
            break;
          }

          if(!split[1]) {
            return offset;
          }

          // Add support for corners @todo css
          if(split[0] === 'top' || split[0] === 'bottom') {
            switch (split[1]) {
            case 'left':
              offset.left = position.left;
              break;
            case 'right':
              offset.left =  position.left + position.width - actualWidth;
            }
          } else if(split[0] === 'left' || split[0] === 'right') {
            switch (split[1]) {
            case 'top':
              offset.top = position.top - actualHeight;
              break;
            case 'bottom':
              offset.top = position.top + position.height;
            }
          }

          return offset;
        }

        return $bstooltip;

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

      return TooltipFactory;

    }];

  })

  .directive('bsTooltip', ["$window", "$location", "$sce", "$bstooltip", "$$rAF", function($window, $location, $sce, $bstooltip, $$rAF) {

    return {
      restrict: 'EAC',
      scope: true,
      link: function postLink(scope, element, attr, transclusion) {

        // Directive options
        var options = {scope: scope};
        angular.forEach(['template', 'contentTemplate', 'placement', 'container', 'target', 'delay', 'trigger', 'keyboard', 'html', 'animation', 'type', 'customClass'], function(key) {
          if(angular.isDefined(attr[key])) options[key] = attr[key];
        });

        // Observe scope attributes for change
        angular.forEach(['title'], function(key) {
          attr.$observe(key, function(newValue, oldValue) {
            scope[key] = $sce.trustAsHtml(newValue);
            angular.isDefined(oldValue) && $$rAF(function() {
              tooltip && tooltip.$applyPlacement();
            });
          });
        });

        // Support scope as an object
        attr.bsTooltip && scope.$watch(attr.bsTooltip, function(newValue, oldValue) {
          if(angular.isObject(newValue)) {
            angular.extend(scope, newValue);
          } else {
            scope.title = newValue;
          }
          angular.isDefined(oldValue) && $$rAF(function() {
            tooltip && tooltip.$applyPlacement();
          });
        }, true);

        // Visibility binding support
        attr.bsShow && scope.$watch(attr.bsShow, function(newValue, oldValue) {
          if(!tooltip || !angular.isDefined(newValue)) return;
          if(angular.isString(newValue)) newValue = !!newValue.match(',?(tooltip),?');
          newValue === true ? tooltip.show() : tooltip.hide();
        });

        // Initialize popover
        var tooltip = $bstooltip(element, options);

        // Garbage collection
        scope.$on('$destroy', function() {
          if(tooltip) tooltip.destroy();
          options = null;
          tooltip = null;
        });

      }
    };

  }]);
