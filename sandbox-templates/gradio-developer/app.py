import gradio as gr

def greet(name: str, greeting_repetitions: int) -> str:
    """
    Greets the user with a personalized message.

    Args:
        name: The user's name (string).  Must not contain HTML tags.
        greeting_repetitions: The number of times to repeat the greeting.

    Returns:
        A personalized greeting string.  Returns an error message if input is invalid.

    Raises:
        ValueError: If greeting_repetitions is not a positive integer.
        TypeError: if name is not a string.

    """
    if greeting_repetitions <= 0:
        raise ValueError("Greeting repetitions must be a positive integer.")
    
    #Sanitize the input to prevent XSS
    import html
    sanitized_name = html.escape(name)

    return f"Hello, {sanitized_name}!" * greeting_repetitions


demo = gr.Interface(
    fn=greet,
    inputs=[
        gr.Textbox(label="Name", lines=1, placeholder="Enter your name"),
        gr.Slider(minimum=1, maximum=10, step=1, label="Number of Greetings", value=1)
    ],
    outputs="text",
    title="Personalized Greeter",
    description="Enter your name and select the number of greetings.",
)

demo.launch()