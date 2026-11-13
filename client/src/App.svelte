<script>
  import Game from './Game.svelte';
</script>

<main>
  <Game />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #000;
  }
  main {
    width: 100vw;
    height: 100vh;
  }
</style>
