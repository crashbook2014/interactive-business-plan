/* Motion layer. Purely additive: elements are visible in the markup and JS
   opts them into an animated arrival, so a script failure can never hide any
   part of the brand spec. */
(function(){
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches || !("IntersectionObserver" in window)) return;

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { threshold:.14, rootMargin:"0px 0px -6% 0px" });

  var sel = "section .kicker, section h2, section .lede, .logo-card, .swatch," +
            " .card, .dont, .small-test .chip, .icon-row figure, .phone";
  document.querySelectorAll(sel).forEach(function(el, i){
    /* Already on screen at load: show immediately, no waiting for a scroll. */
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92){
      el.classList.add("rv","in");
      return;
    }
    el.classList.add("rv");
    var step = i % 3;
    if (step) el.classList.add("rv-d" + step);
    io.observe(el);
  });

  /* Safety net: fast or programmatic scrolling can let the observer coalesce
     past a tall element, which would leave it invisible. Anything whose top
     has reached the viewport is revealed regardless. Content visibility must
     never depend on how quickly someone scrolls. */
  var sweeping = false;
  function sweep(){
    sweeping = false;
    document.querySelectorAll(".rv:not(.in)").forEach(function(el){
      if (el.getBoundingClientRect().top < window.innerHeight){
        el.classList.add("in");
        io.unobserve(el);
      }
    });
  }
  window.addEventListener("scroll", function(){
    if (sweeping) return;
    sweeping = true;
    requestAnimationFrame(sweep);
  }, { passive:true });
  window.addEventListener("load", sweep);
})();
