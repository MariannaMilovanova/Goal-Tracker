class FormDataPolyfill {
  append() {}
}

global.FormData = global.FormData || FormDataPolyfill;
