using UnityEngine;

public class QuitButton : MonoBehaviour
{
    // Called from a UI Button OnClick()
    public void QuitGame()
    {
        // If running in the Editor
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        // If built as an app or game
        Application.Quit();
#endif
    }
}


