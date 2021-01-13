const bind = (scope, fn) => function () {
	fn.apply(scope, arguments);
};

class VRDesktopControls {
  constructor(object, domElement) {
    if (domElement === undefined) {
      console.warn('VRDesktopControls: The second parameter "domElement" is now mandatory.');
      domElement = document;
    }

    if (domElement !== document) {
      domElement.setAttribute('tabindex', -1);
    }

    this.object = object;
    this.domElement = domElement;

    const _onMouseMove = bind(this, this.onMouseMove);
    const _onMouseDown = bind(this, this.onMouseDown);
    const _onMouseUp = bind(this, this.onMouseUp);
    const _onKeyDown = bind(this, this.onKeyDown);
    const _onKeyUp = bind(this, this.onKeyUp);
    domElement.addEventListener('mousemove', _onMouseMove, false);
    domElement.addEventListener('mousedown', _onMouseDown, false);
    domElement.addEventListener('mouseup', _onMouseUp, false);
    domElement.addEventListener('touchmove', _onMouseMove, false);
    domElement.addEventListener('touchstart', _onMouseDown, false);
    domElement.addEventListener('touchend', _onMouseUp, false);
    window.addEventListener('keydown', _onKeyDown, false);
    window.addEventListener('keyup', _onKeyUp, false);
    domElement.addEventListener('contextmenu', this.contextmenu, false);

    // API
    this.enabled = true;

    this.movementSpeed = 1.0;
    this.lookSpeed = 0.005;

    this.lookVertical = true;
    this.autoForward = false;

    this.activeLook = true;

    this.heightSpeed = false;
    this.heightCoef = 1.0;
    this.heightMin = 0.0;
    this.heightMax = 1.0;

    this.constrainVertical = false;
    this.verticalMin = 0;
    this.verticalMax = Math.PI;

    this.mouseDragOn = false;

    // internals
    this.autoSpeedFactor = 0.0;

    this.mouseX = 0;
    this.mouseY = 0;
    this.prevMouseX = 0;
    this.prevMouseY = 0;
    this.deltaMouseX = 0;
    this.deltaMouseY = 0;
    this.targetPosition = new THREE.Vector3(0, 100, 1);

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;

    this.viewHalfX = 0;
    this.viewHalfY = 0;

    // private variables
    this.lat = 0;
    this.lon = 0;

    this.lookDirection = new THREE.Vector3();
    this.spherical = new THREE.Spherical();
    this.target = new THREE.Vector3();

    this.handleResize();

    this.setOrientation();
  }

  handleResize () {
    if (this.domElement === document) {
      this.viewHalfX = window.innerWidth / 2;
      this.viewHalfY = window.innerHeight / 2;
    } else {
      this.viewHalfX = this.domElement.offsetWidth / 2;
      this.viewHalfY = this.domElement.offsetHeight / 2;
    }
  }

  onMouseDown (event) {
    if (this.domElement !== document) {
      this.domElement.focus();
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.domElement === document) {
      this.mouseX = event.pageX - this.viewHalfX;
      this.mouseY = event.pageY - this.viewHalfY;
    } else {
      this.mouseX = event.pageX - this.domElement.offsetLeft - this.viewHalfX;
      this.mouseY = event.pageY - this.domElement.offsetTop - this.viewHalfY;
    }

    this.prevMouseX = this.mouseX;
    this.prevMouseY = this.mouseY;

    // if ( this.activeLook ) {
    //   switch ( event.button ) {
    //     case 0: this.moveForward = true; break;
    //     case 2: this.moveBackward = true; break;
    //   }
    // }
    this.mouseDragOn = true;
  }

  onMouseUp (event) {
    event.preventDefault();
    event.stopPropagation();

    // if ( this.activeLook ) {
    //   switch ( event.button ) {
    //     case 0: this.moveForward = false; break;
    //     case 2: this.moveBackward = false; break;
    //   }
    // }
    this.mouseDragOn = false;
  }

  onMouseMove (event) {
    if (!this.mouseDragOn) {
      return;
    }

    if (this.domElement === document) {
      this.mouseX = event.pageX - this.viewHalfX;
      this.mouseY = event.pageY - this.viewHalfY;
    } else {
      this.mouseX = event.pageX - this.domElement.offsetLeft - this.viewHalfX;
      this.mouseY = event.pageY - this.domElement.offsetTop - this.viewHalfY;
    }

    // var rect = _domElement.getBoundingClientRect();
    // _mouse.x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
    // _mouse.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;
  }

  onKeyDown (event) {
    //event.preventDefault();

    switch (event.keyCode) {
      case 38: /*up*/
      case 87: /*W*/ this.moveForward = true; break;

      case 37: /*left*/
      case 65: /*A*/ this.moveLeft = true; break;

      case 40: /*down*/
      case 83: /*S*/ this.moveBackward = true; break;

      case 39: /*right*/
      case 68: /*D*/ this.moveRight = true; break;

      case 82: /*R*/ this.moveUp = true; break;
      case 70: /*F*/ this.moveDown = true; break;
    }
  }

  onKeyUp (event) {
    switch (event.keyCode) {
      case 38: /*up*/
      case 87: /*W*/ this.moveForward = false; break;

      case 37: /*left*/
      case 65: /*A*/ this.moveLeft = false; break;

      case 40: /*down*/
      case 83: /*S*/ this.moveBackward = false; break;

      case 39: /*right*/
      case 68: /*D*/ this.moveRight = false; break;

      case 82: /*R*/ this.moveUp = false; break;
      case 70: /*F*/ this.moveDown = false; break;
    }
  };

  lookAt (x, y, z) {
    if (x.isVector3) {
      this.target.copy(x);
    } else {
      this.target.set(x, y, z);
    }

    this.object.lookAt(this.target);

    this.setOrientation(this);

    return this;
  }

  update (delta) {
    if (this.enabled === false || !this.mouseDragOn)
      return;

    if (this.heightSpeed) {
      var y = THREE.MathUtils.clamp(this.object.position.y, this.heightMin, this.heightMax);
      var heightDelta = y - this.heightMin;

      this.autoSpeedFactor = delta * (heightDelta * this.heightCoef);

    } else {
      this.autoSpeedFactor = 0.0;
    }

    var actualMoveSpeed = delta * this.movementSpeed;

    if (this.moveForward || (this.autoForward && !this.moveBackward))
      this.object.translateZ(-(actualMoveSpeed + this.autoSpeedFactor));
    if (this.moveBackward)
      this.object.translateZ(actualMoveSpeed);

    if (this.moveLeft)
      this.object.translateX(-actualMoveSpeed);
    if (this.moveRight)
      this.object.translateX(actualMoveSpeed);

    if (this.moveUp)
      this.object.translateY(actualMoveSpeed);
    if (this.moveDown)
      this.object.translateY(-actualMoveSpeed);

    var actualLookSpeed = delta * this.lookSpeed;

    if (!this.activeLook) {
      actualLookSpeed = 0;
    }

    var verticalLookRatio = 1;

    if (this.constrainVertical) {
      verticalLookRatio = Math.PI / (this.verticalMax - this.verticalMin);
    }

    const veloX = (this.mouseX - this.prevMouseX) / delta * this.lookSpeed;
    const veloY = (this.mouseY - this.prevMouseY) / delta * this.lookSpeed;

    // lon -= this.mouseX * actualLookSpeed;
    // if ( this.lookVertical ) lat -= this.mouseY * actualLookSpeed * verticalLookRatio;
    this.lon -= veloX;
    if (this.lookVertical)
      this.lat -= veloY * verticalLookRatio;

    this.lat = Math.max(-85, Math.min(85, this.lat));

    var phi = THREE.MathUtils.degToRad(90 - this.lat);
    var theta = THREE.MathUtils.degToRad(this.lon);

    if (this.constrainVertical) {
      phi = THREE.MathUtils.mapLinear(phi, 0, Math.PI, this.verticalMin, this.verticalMax);
    }

    this.deltaMouseX = this.mouseX - this.prevMouseX;
    this.deltaMouseY = this.mouseY - this.prevMouseY;

    this.targetPosition.setFromSphericalCoords(1, phi, theta).add(this.object.position);

    this.object.lookAt(this.targetPosition);

    this.prevMouseX = this.mouseX;
    this.prevMouseY = this.mouseY;
  }

  contextmenu (event) {
    event.preventDefault();
  }

  setOrientation () {
    var quaternion = this.object.quaternion;

    this.lookDirection.set(0, 0, -1).applyQuaternion(quaternion);
    this.spherical.setFromVector3(this.lookDirection);

    this.lat = 90 - THREE.MathUtils.radToDeg(this.spherical.phi);
    this.lon = THREE.MathUtils.radToDeg(this.spherical.theta);
  }
}

export { VRDesktopControls }
