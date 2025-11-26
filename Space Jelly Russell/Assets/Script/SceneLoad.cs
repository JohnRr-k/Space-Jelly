using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

public class SceneLoad : MonoBehaviour
{
    public void pilihScene(string name)
    {
        SceneManager.LoadScene(name);
    }

    public void OnApplicationQuit()
    {
        Application.Quit();
    }
}

